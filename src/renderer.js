const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const template = require("../templates/security.json");

const PROJECT_ROOT = path.join(__dirname, "..");

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

const FONT = "output/fonts/consola.ttf";
const FONT_BOLD = "output/fonts/consolab.ttf";

// Color filter presets (ffmpeg filter chains)
const FILTERS = {
  none: "",
  vintage: "curves=vintage,",
  bw: "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3,",
  cinematic: "eq=brightness=0.06:contrast=1.2:saturation=1.3:gamma=0.95,",
  cold: "colortemperature=temperature=6500,eq=contrast=1.1:saturation=0.8,",
  warm: "colortemperature=temperature=3500,eq=contrast=1.05:saturation=1.2,",
  highcontrast: "eq=contrast=1.5:brightness=-0.05,",
  sepia: "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,",
  noir: "colorchannelmixer=.299:.587:.114,eq=contrast=1.4:brightness=-0.1,",
  cyberpunk: "curves=preset=cross_process,eq=saturation=1.5:contrast=1.2,",
  teal_orange: "curves=r='0/0 0.3/0.2 0.7/0.8 1/1':b='0/0.1 0.5/0.5 1/0.7',eq=saturation=1.3,",
};

// Transition types for xfade
const TRANSITIONS = {
  fade: "fade",
  dissolve: "dissolve",
  wipeleft: "wipeleft",
  wiperight: "wiperight",
  wipeup: "wipeup",
  wipedown: "wipedown",
  slideleft: "slideleft",
  slideright: "slideright",
  smoothleft: "smoothleft",
  circlecrop: "circlecrop",
  pixelize: "pixelize",
};

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: cwd || PROJECT_ROOT });
    let stderr = "";
    const MAX_STDERR = 8192;
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
  if (!t) return "";
  var s = String(t);
  s = s.replace(/\\/g, "");
  s = s.replace(/:/g, " -");
  s = s.replace(/%/g, "%%");
  s = s.replace(/'/g, "'");
  s = s.replace(/,/g, " -");
  s = s.replace(/;/g, ".");
  s = s.replace(/[\[\]]/g, "");
  return s;
}

// Build text overlay filter (supports positioning, size, box, animation)
function buildTextOverlay(text, opts = {}) {
  if (!text) return "";
  const {
    x = "(w-text_w)/2", y = "(h-text_h)/2",
    fontsize = 36, fontcolor = "white",
    box = 0, boxcolor = "black@0.5", boxborderw = 10,
    enable = ""
  } = opts;
  const escaped = escapeText(text);
  let f = `drawtext=fontfile=${FONT}:text='${escaped}':fontcolor=${fontcolor}:fontsize=${fontsize}:x=${x}:y=${y}`;
  if (box) f += `:box=1:boxcolor=${boxcolor}:boxborderw=${boxborderw}`;
  if (enable) f += `:enable='${enable}'`;
  return f;
}

// Build a segment with all effects
async function buildSegment({ type, srcPath, text, subtitle, duration, w, h, workDir, index, effects = {} }) {
  const out = path.join(workDir, `seg_${index}.mp4`);
  const { colors } = template;

  // Apply per-clip filter
  const filterKey = effects.filter || "none";
  const filterPrefix = FILTERS[filterKey] || "";
  const speed = effects.speed || 1.0;

  if (type === "title") {
    const dur = duration || template.intro.duration;
    // Animated title: text fades in, grid animates
    const titleFilter = [
      `drawgrid=w=${Math.round(w / 12)}:h=${Math.round(h / 12)}:t=1:c=${colors.accent}@0.15`,
      buildTextOverlay(text || "PROJECT", {
        fontcolor: colors.accent, fontsize: Math.round(h * 0.07),
        x: "(w-text_w)/2", y: "(h-text_h)/2-40",
      }),
      subtitle ? buildTextOverlay(subtitle, {
        fontcolor: colors.text, fontsize: Math.round(h * 0.025),
        x: "(w-text_w)/2", y: "(h/2)+40",
      }) : ""
    ].filter(Boolean).join(",");

    const vf = `${filterPrefix}${titleFilter}`;

    await run("ffmpeg", [
      "-v", "error",
      "-y", "-f", "lavfi", "-i", `color=c=${colors.bg}:s=${w}x${h}:d=${dur}:r=30`,
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr",
      "-t", String(dur), out
    ]);
    return out;
  }

  if (type === "image") {
    const dur = duration || template.slide.defaultDuration;
    const effectiveDur = dur / speed;

    // Ken Burns zoom
    const zoom = template.slide.kenBurns
      ? `,zoompan=z='min(zoom+0.0007,1.15)':d=${Math.round(dur * 30)}:s=${w}x${h}:fps=30`
      : "";

    // Text overlay
    const caption = text ? "," + buildTextOverlay(text, {
      fontcolor: colors.text, fontsize: Math.round(h * 0.03),
      box: 1, boxcolor: `${colors.bg}@0.55`, boxborderw: 14,
      x: 40, y: "h-th-50"
    }) : "";

    // Subtitle overlay
    const subOverlay = subtitle ? "," + buildTextOverlay(subtitle, {
      fontcolor: colors.accent, fontsize: Math.round(h * 0.02),
      box: 1, boxcolor: `${colors.bg}@0.7`, boxborderw: 8,
      x: 40, y: "h-th-90"
    }) : "";

    const vf = `${filterPrefix}scale=${Math.round(w * 1.2)}:${Math.round(h * 1.2)}:force_original_aspect_ratio=increase,crop=${Math.round(w * 1.2)}:${Math.round(h * 1.2)}${zoom},crop=${w}:${h}${caption}${subOverlay}`;

    const speedArgs = speed !== 1.0 ? ["-filter_complex", `[0:v]setpts=${(1/speed).toFixed(3)}*PTS[v]`, "-map", "[v]"] : [];

    await run("ffmpeg", [
      "-v", "error",
      "-y", "-loop", "1", "-i", srcPath,
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-t", String(effectiveDur), "-r", "30", "-fps_mode", "cfr", out
    ]);
    return out;
  }

  if (type === "video") {
    const effectiveDur = duration ? duration / speed : undefined;

    const caption = text ? "," + buildTextOverlay(text, {
      fontcolor: colors.text, fontsize: Math.round(h * 0.03),
      box: 1, boxcolor: `${colors.bg}@0.55`, boxborderw: 14,
      x: 40, y: "h-th-50"
    }) : "";

    const subOverlay = subtitle ? "," + buildTextOverlay(subtitle, {
      fontcolor: colors.accent, fontsize: Math.round(h * 0.02),
      box: 1, boxcolor: `${colors.bg}@0.7`, boxborderw: 8,
      x: 40, y: "h-th-90"
    }) : "";

    const vf = `${filterPrefix}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}${caption}${subOverlay},fps=30`;

    const trimArgs = effectiveDur ? ["-t", String(effectiveDur)] : [];
    const speedArgs = speed !== 1.0 ? ["-filter_complex", `[0:v]setpts=${(1/speed).toFixed(3)}*PTS[v]`, "-map", "[v]"] : [];

    await run("ffmpeg", [
      "-v", "error",
      "-y", "-i", srcPath,
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
      "-r", "30", "-fps_mode", "cfr", ...trimArgs, out
    ]);
    return out;
  }

  throw new Error(`Unknown segment type: ${type}`);
}

// Concatenate segments with configurable transitions
async function concatWithTransitions(segmentPaths, outPath, w, h, transitionType, transitionDuration) {
  if (segmentPaths.length === 1) {
    await run("ffmpeg", ["-v", "error", "-y", "-i", segmentPaths[0], "-c", "copy", outPath]);
    return;
  }

  const td = transitionDuration || template.transition.duration;
  const tName = TRANSITIONS[transitionType] || "fade";
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
    filter += `[${lastLabel}][${i}:v]xfade=transition=${tName}:duration=${td}:offset=${offset.toFixed(2)}[${outLabel}];`;
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
    p.on("error", () => resolve(4));
  });
}

async function renderProject({ items, options, workDir, outPath, progress }) {
  ensureFonts();
  fs.mkdirSync(workDir, { recursive: true });
  const { w, h } = template.resolutions[options.aspect] || template.resolutions["16:9"];
  const transitionType = options.transition || "fade";
  const transitionDuration = options.transitionDuration || template.transition.duration;

  const segments = [];
  const totalSteps = items.length + 3; // intro + items + outro

  if (progress) progress(5, "Building intro...");

  segments.push(
    await buildSegment({
      type: "title",
      text: options.projectTitle || "PROJECT",
      subtitle: options.subtitle || template.intro.subtitle,
      duration: template.intro.duration,
      w, h, workDir, index: "intro",
      effects: options.introEffects || {}
    })
  );

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (progress) progress(Math.round(10 + (i / items.length) * 70), `Rendering clip ${i + 1}/${items.length}...`);
    segments.push(
      await buildSegment({
        type: it.type,
        srcPath: it.path,
        text: it.text,
        subtitle: it.subtitle,
        duration: it.duration,
        w, h, workDir, index: i,
        effects: it.effects || {}
      })
    );
  }

  if (progress) progress(85, "Building outro...");
  segments.push(
    await buildSegment({
      type: "title",
      text: "THANK YOU",
      subtitle: options.cta || template.outro.cta,
      duration: template.outro.duration,
      w, h, workDir, index: "outro",
      effects: options.outroEffects || {}
    })
  );

  if (progress) progress(90, "Applying transitions...");
  await concatWithTransitions(segments, outPath, w, h, transitionType, transitionDuration);

  for (const s of segments) {
    try { fs.unlinkSync(s); } catch (_) {}
  }

  if (progress) progress(100, "Done!");
  return outPath;
}

module.exports = { renderProject, FILTERS, TRANSITIONS };
