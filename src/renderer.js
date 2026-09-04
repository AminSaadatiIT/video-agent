const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const template = require("../templates/security.json");

const PROJECT_ROOT = path.join(__dirname, "..");

// Ensure fonts at a colon-free relative path
function ensureFonts() {
  const fontDir = path.join(PROJECT_ROOT, "output", "fonts");
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
    try {
      if (fs.existsSync(template.font)) fs.copyFileSync(template.font, path.join(fontDir, "consola.ttf"));
      if (fs.existsSync(template.fontRegular)) fs.copyFileSync(template.fontRegular, path.join(fontDir, "consolab.ttf"));
    } catch (_) {}
  }
}

// Relative font path from project root (no colons!)
const FONT = "output/fonts/consola.ttf";
const FONT_BOLD = "output/fonts/consolab.ttf";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: PROJECT_ROOT });
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
  return String(t).replace(/:/g, "\\:").replace(/%/g, "%%");
}

async function buildSegment({ type, srcPath, text, subtitle, duration, w, h, workDir, index }) {
  const out = path.join(workDir, `seg_${index}.mp4`);
  const { colors } = template;

  if (type === "title") {
    const dur = duration || template.intro.duration;
    const drawText = `drawtext=fontfile=${FONT_BOLD}:text='${escapeText(text)}':fontcolor=${colors.accent}:fontsize=${Math.round(h * 0.07)}:x=(w-text_w)/2:y=(h-text_h)/2-40`;
    const drawSub = subtitle
      ? `,drawtext=fontfile=${FONT}:text='${escapeText(subtitle)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.025)}:x=(w-text_w)/2:y=(h/2)+40`
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
    const zoom = template.slide.kenBurns
      ? `,zoompan=z='min(zoom+0.0007,1.15)':d=${dur * 30}:s=${w}x${h}:fps=30`
      : "";
    const caption = text
      ? `,drawtext=fontfile=${FONT}:text='${escapeText(text)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.03)}:box=1:boxcolor=${colors.bg}@0.55:boxborderw=14:x=40:y=h-th-50`
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
      ? `,drawtext=fontfile=${FONT}:text='${escapeText(text)}':fontcolor=${colors.text}:fontsize=${Math.round(h * 0.03)}:box=1:boxcolor=${colors.bg}@0.55:boxborderw=14:x=40:y=h-th-50`
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
    "-map", "[vout]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", outPath
  ]);
}

function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = path.join(PROJECT_ROOT, "ffmpeg", "bin", "ffprobe.exe");
    const ffprobe = fs.existsSync(ffprobePath) ? ffprobePath : "ffprobe";
    const p = spawn(ffprobe, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(parseFloat(out.trim()) || 4));
    p.on("error", reject);
  });
}

async function renderProject({ items, options, workDir, outPath }) {
  ensureFonts();
  fs.mkdirSync(workDir, { recursive: true });
  const { w, h } = template.resolutions[options.aspect] || template.resolutions["16:9"];

  const segments = [];

  segments.push(
    await buildSegment({
      type: "title",
      text: options.projectTitle || "PROJECT",
      subtitle: options.subtitle || template.intro.subtitle,
      duration: template.intro.duration,
      w, h, workDir, index: "intro"
    })
  );

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

  segments.push(
    await buildSegment({
      type: "title",
      text: "THANK YOU",
      subtitle: options.cta || template.outro.cta,
      duration: template.intro.duration,
      w, h, workDir, index: "outro"
    })
  );

  await concatWithTransitions(segments, outPath, w, h);

  for (const s of segments) {
    try { fs.unlinkSync(s); } catch (_) {}
  }

  return outPath;
}

module.exports = { renderProject };
