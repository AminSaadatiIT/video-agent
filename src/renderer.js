const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const template = require("../templates/security.json");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = "";
    const MAX_STDERR = 4096;
    p.stderr.on("data", (d) => {
      if (stderr.length < MAX_STDERR) stderr += d.toString();
    });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

function escapeText(t) {
  return String(t).replace(/\\/g, "\\\\\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
}

// Escape font path for ffmpeg drawtext filter (colons need escaping)
function escapeFontPath(p) {
  return String(p).replace(/:/g, "\\:");
}

// Build one normalized clip (image slide, video clip, or title card) as an mp4 segment
async function buildSegment({ type, srcPath, text, subtitle, duration, w, h, workDir, index }) {
  const out = path.join(workDir, `seg_${index}.mp4`);
  const { colors, font, fontRegular } = template;

  if (type === "title") {
    // Solid bg + grid pattern + big title text (used for intro/outro)
    const dur = duration || template.intro.duration;
    const drawText = `drawtext=fontfile='${escapeFontPath(font)}':text='${escapeText(text)}':fontcolor=${colors.accent}:fontsize=${Math.round(h * 0.07)}:x=(w-text_w)/2:y=(h-text_h)/2-40`;
    const drawSub = subtitle
      ? `,drawtext=fontfile='${escapeFontPath(fontRegular)}':text='${escapeText(subtitle)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.025)}:x=(w-text_w)/2:y=(h/2)+40`
      : "";
    const vf = `drawgrid=w=${Math.round(w / 12)}:h=${Math.round(h / 12)}:t=1:c=${colors.accent}@0.15,${drawText}${drawSub}`;
    await run("ffmpeg", [
      "-v", "error",
      "-y", "-f", "lavfi", "-i", `color=c=${colors.bg}:s=${w}x${h}:d=${dur}:r=30`,
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-t", String(dur), out
    ]);
    return out;
  }

  if (type === "image") {
    const dur = duration || template.slide.defaultDuration;
    // Ken Burns: slow zoom + pan, scaled up first for smoothness
    const zoom = template.slide.kenBurns
      ? `,zoompan=z='min(zoom+0.0007,1.15)':d=${dur * 30}:s=${w}x${h}:fps=30`
      : "";
    const caption = text
      ? `,drawtext=fontfile='${escapeFontPath(fontRegular)}':text='${escapeText(text)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.03)}:box=1:boxcolor=${colors.bg}@0.55:boxborderw=14:x=40:y=h-th-50`
      : "";
    await run("ffmpeg", [
      "-v", "error",
      "-y", "-loop", "1", "-i", srcPath,
      "-vf", `scale=${w * 1.2}:${h * 1.2}:force_original_aspect_ratio=increase,crop=${w * 1.2}:${h * 1.2}${zoom},crop=${w}:${h}${caption}`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", String(dur), "-r", "30", "-fps_mode", "cfr", out
    ]);
    return out;
  }

  if (type === "video") {
    const caption = text
      ? `,drawtext=fontfile='${escapeFontPath(fontRegular)}':text='${escapeText(text)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.03)}:box=1:boxcolor=${colors.bg}@0.55:boxborderw=14:x=40:y=h-th-50`
      : "";
    const trim = duration ? ["-t", String(duration)] : [];
    await run("ffmpeg", [
      "-v", "error",
      "-y", "-i", srcPath,
      "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}${caption},fps=30`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-r", "30", "-fps_mode", "cfr", ...trim, out
    ]);
    return out;
  }

  throw new Error(`Unknown segment type: ${type}`);
}

// Concatenate segments with crossfade transitions using xfade
async function concatWithTransitions(segmentPaths, outPath, w, h) {
  if (segmentPaths.length === 1) {
    await run("ffmpeg", ["-v", "error", "-y", "-i", segmentPaths[0], "-c", "copy", outPath]);
    return;
  }

  const td = template.transition.duration;
  const durations = [];
  for (const p of segmentPaths) {
    durations.push(await getDuration(p));
  }

  let filter = "";
  let lastLabel = "0:v";
  let cumulative = durations[0];
  const inputs = [];
  segmentPaths.forEach((p) => inputs.push("-i", p));

  for (let i = 1; i < segmentPaths.length; i++) {
    const offset = cumulative - td;
    const outLabel = i === segmentPaths.length - 1 ? "vout" : `v${i}`;
    filter += `[${lastLabel}][${i}:v]xfade=transition=fade:duration=${td}:offset=${offset.toFixed(2)}[${outLabel}];`;
    lastLabel = outLabel;
    cumulative += durations[i] - td;
  }
  filter = filter.replace(/;$/, "");

  await run("ffmpeg", [
    "-v", "error",
    "-y", ...inputs,
    "-filter_complex", filter,
    "-map", `[vout]`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", outPath
  ]);
}

function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(parseFloat(out.trim()) || 4));
    p.on("error", reject);
  });
}

/**
 * items: [{ type: 'image'|'video', path, text, duration }]
 * options: { aspect: '16:9'|'9:16'|'1:1', projectTitle, subtitle, cta }
 */
async function renderProject({ items, options, workDir, outPath }) {
  fs.mkdirSync(workDir, { recursive: true });
  const { w, h } = template.resolutions[options.aspect] || template.resolutions["16:9"];

  const segments = [];

  // Intro title card
  segments.push(
    await buildSegment({
      type: "title",
      text: options.projectTitle || "PROJECT",
      subtitle: options.subtitle || template.intro.subtitle,
      duration: template.intro.duration,
      w, h, workDir, index: "intro"
    })
  );

  // Body items
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    segments.push(
      await buildSegment({
        type: it.type,
        srcPath: it.path,
        text: it.text,
        duration: it.duration,
        w, h, workDir, index: i
      })
    );
  }

  // Outro title card
  segments.push(
    await buildSegment({
      type: "title",
      text: "THANK YOU",
      subtitle: options.cta || template.outro.cta,
      duration: template.outro.duration,
      w, h, workDir, index: "outro"
    })
  );

  await concatWithTransitions(segments, outPath, w, h);

  // cleanup segments
  for (const s of segments) {
    try { fs.unlinkSync(s); } catch (_) {}
  }

  return outPath;
}

module.exports = { renderProject };
