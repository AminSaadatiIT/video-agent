// ---------------------------------------------------------------------------
// AI Clip Generator — generates title cards from text prompts using ffmpeg.
// Uses relative font paths (no drive letters) to avoid Windows escaping.
// ---------------------------------------------------------------------------

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.join(__dirname, "..");

// Ensure fonts at colon-free relative path
function ensureFonts() {
  const fontDir = path.join(PROJECT_ROOT, "output", "fonts");
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
    try {
      const srcConsola = "C:/Windows/Fonts/consola.ttf";
      const srcConsolab = "C:/Windows/Fonts/consolab.ttf";
      if (fs.existsSync(srcConsola)) fs.copyFileSync(srcConsola, path.join(fontDir, "consola.ttf"));
      if (fs.existsSync(srcConsolab)) fs.copyFileSync(srcConsolab, path.join(fontDir, "consolab.ttf"));
    } catch (_) {}
  }
}

// Detect local ffmpeg path
function findFFmpeg() {
  const local = path.join(PROJECT_ROOT, "ffmpeg", "bin", "ffmpeg.exe");
  if (fs.existsSync(local)) return local;
  return "ffmpeg";
}

function escapeText(t) {
  return String(t).replace(/:/g, "\\:").replace(/%/g, "%%");
}

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
      else reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-1000)}`));
    });
  });
}

// Generate an animated title card clip from an AI prompt
async function generateAIClip({ prompt, workDir }) {
  fs.mkdirSync(workDir, { recursive: true });
  ensureFonts();

  const out = path.join(workDir, `ai_${Date.now()}.mp4`);
  const ffmpeg = findFFmpeg();

  // IMPORTANT: Use relative paths from project root — no colons, no spaces
  const font = "output/fonts/consola.ttf";
  const fontBold = "output/fonts/consolab.ttf";

  const lines = parseAIPrompt(prompt || "AI Generated Content");

  const filters = [];
  filters.push("drawgrid=w=96:h=54:t=1:c=0x00e5ff@0.08");

  const title = escapeText(lines.title || "AI SEGMENT");
  filters.push(
    `drawtext=fontfile=${fontBold}:text='${title}':fontcolor=0x00e5ff:fontsize=72:x=(w-text_w)/2:y=(h/2)-80`
  );

  if (lines.subtitle) {
    const sub = escapeText(lines.subtitle);
    filters.push(
      `drawtext=fontfile=${font}:text='${sub}':fontcolor=0xe8f6ff:fontsize=32:x=(w-text_w)/2:y=(h/2)+20`
    );
  }

  if (lines.detail) {
    const det = escapeText(lines.detail);
    filters.push(
      `drawtext=fontfile=${font}:text='${det}':fontcolor=0x39ff88:fontsize=22:x=(w-text_w)/2:y=(h/2)+70`
    );
  }

  const vf = filters.join(",");

  // CWD must be project root for relative font paths
  await new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=0x0a0e17:s=1920x1080:d=3:r=30",
      "-vf", vf,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-fps_mode", "cfr",
      "-t", "3",
      out
    ], { cwd: PROJECT_ROOT });
    let stderr = "";
    const MAX_STDERR = 4096;
    p.stderr.on("data", (d) => { if (stderr.length < MAX_STDERR) stderr += d.toString(); });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-1000)}`));
    });
  });

  return out;
}

// Parse an AI prompt into structured title/subtitle/detail lines
function parseAIPrompt(prompt) {
  const text = prompt.trim();
  const parts = text.split(/[|,.\n]/).map(s => s.trim()).filter(Boolean);

  if (parts.length >= 3) {
    return { title: parts[0], subtitle: parts[1], detail: parts.slice(2).join(" | ") };
  }
  if (parts.length === 2) {
    return { title: parts[0], subtitle: parts[1], detail: "" };
  }
  const words = text.split(/\s+/);
  if (words.length > 6) {
    const mid = Math.ceil(words.length / 2);
    return {
      title: words.slice(0, mid).join(" "),
      subtitle: words.slice(mid).join(" "),
      detail: ""
    };
  }
  return { title: text, subtitle: "", detail: "" };
}

module.exports = { generateAIClip };
