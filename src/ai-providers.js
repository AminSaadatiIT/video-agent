// ---------------------------------------------------------------------------
// AI Clip Generator — generates professional animated title cards.
// Multiple templates, animated text, structured scene parsing.
// ---------------------------------------------------------------------------

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.join(__dirname, "..");

function ensureFonts() {
  const fontDir = path.join(PROJECT_ROOT, "output", "fonts");
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
    try {
      const srcConsola = "C:/Windows/Fonts/consola.ttf";
      const srcConsolab = "C:/Windows/Fonts/consolab.ttf";
      const srcArial = "C:/Windows/Fonts/arial.ttf";
      const srcArialb = "C:/Windows/Fonts/arialbd.ttf";
      if (fs.existsSync(srcConsola)) fs.copyFileSync(srcConsola, path.join(fontDir, "consola.ttf"));
      if (fs.existsSync(srcConsolab)) fs.copyFileSync(srcConsolab, path.join(fontDir, "consolab.ttf"));
      if (fs.existsSync(srcArial)) fs.copyFileSync(srcArial, path.join(fontDir, "arial.ttf"));
      if (fs.existsSync(srcArialb)) fs.copyFileSync(srcArialb, path.join(fontDir, "arialbd.ttf"));
    } catch (_) {}
  }
}

function findFFmpeg() {
  const local = path.join(PROJECT_ROOT, "ffmpeg", "bin", "ffmpeg.exe");
  if (fs.existsSync(local)) return local;
  return "ffmpeg";
}

function escapeText(t) {
  return String(t).replace(/:/g, "\\:").replace(/%/g, "%%").replace(/'/g, "\u2019");
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: cwd || PROJECT_ROOT });
    let stderr = "";
    const MAX_STDERR = 8192;
    p.stderr.on("data", (d) => { if (stderr.length < MAX_STDERR) stderr += d.toString(); });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-1000)}`));
    });
  });
}

// ─── Scene Templates ────────────────────────────────────────────────────
const SCENE_TEMPLATES = {
  security: {
    bg: "0x0a0e17",
    accent: "0x00e5ff",
    accent2: "0x39ff88",
    text: "0xe8f6ff",
    grid: "drawgrid=w=96:h=54:t=1:c=0x00e5ff@0.08",
    tags: ["NETWORK", "SECURITY", "AUDIT", "FIREWALL", "PENTEST", "SIEM", "IDS/IPS", "VULNERABILITY", "ENCRYPTION", "ZERO TRUST"],
    slogans: [
      "SECURE // ANALYZE // DEFEND",
      "IDENTIFY → PROTECT → DETECT → RESPOND → RECOVER",
      "DEFENSE IN DEPTH",
      "TRUST BUT VERIFY",
      "PERIMETER-less SECURITY",
    ],
  },
  corporate: {
    bg: "0x0f172a",
    accent: "0x3b82f6",
    accent2: "0x10b981",
    text: "0xf1f5f9",
    grid: "drawgrid=w=120:h=67:t=1:c=0x3b82f6@0.06",
    tags: ["STRATEGY", "GROWTH", "INNOVATION", "LEADERSHIP", "EXCELLENCE", "TRANSFORMATION"],
    slogans: [
      "DRIVING RESULTS",
      "BEYOND EXPECTATIONS",
      "EXCELLENCE IN EXECUTION",
      "FROM VISION TO VALUE",
    ],
  },
  tech: {
    bg: "0x050510",
    accent: "0x8b5cf6",
    accent2: "0x06b6d4",
    text: "0xe2e8f0",
    grid: "drawgrid=w=80:h=45:t=1:c=0x8b5cf6@0.1",
    tags: ["AI/ML", "CLOUD", "DEVOPS", "CONTAINER", "KUBERNETES", "API", "MICROSERVICE", "IOT", "BLOCKCHAIN"],
    slogans: [
      "BUILD // DEPLOY // SCALE",
      "CODE → SHIP → ITERATE",
      "INFRASTRUCTURE AS CODE",
      "AUTOMATE EVERYTHING",
    ],
  },
  minimal: {
    bg: "0x18181b",
    accent: "0xfafafa",
    accent2: "0xa1a1aa",
    text: "0xfafafa",
    grid: "",
    tags: ["CONCEPT", "VISION", "CLARITY", "ESSENCE", "FOCUS"],
    slogans: [
      "LESS IS MORE",
      "SIMPLICITY IS KEY",
      "EVERY PIXEL COUNTS",
    ],
  },
  bold: {
    bg: "0x1a0000",
    accent: "0xff3860",
    accent2: "0xff9f43",
    text: "0xfff1f2",
    grid: "drawgrid=w=72:h=40:t=1:c=0xff3860@0.12",
    tags: ["IMPACT", "LAUNCH", "DISRUPT", "DOMINATE", "CONQUER", "REBEL"],
    slogans: [
      "BREAK THE RULES",
      "MAKE NOISE",
      "GO BIG OR GO HOME",
      "NO LIMITS",
    ],
  },
};

// ─── Parse AI prompt into structured scene data ─────────────────────────
function parsePrompt(prompt, templateKey) {
  const tmpl = SCENE_TEMPLATES[templateKey] || SCENE_TEMPLATES.security;
  const text = prompt.trim();
  const parts = text.split(/[|\n]/).map(s => s.trim()).filter(Boolean);

  let title, subtitle, detail, tag;

  if (parts.length >= 3) {
    title = parts[0];
    subtitle = parts[1];
    detail = parts.slice(2).join(" | ");
    tag = tmpl.tags[Math.floor(Math.random() * tmpl.tags.length)];
  } else if (parts.length === 2) {
    title = parts[0];
    subtitle = parts[1];
    detail = "";
    tag = tmpl.tags[Math.floor(Math.random() * tmpl.tags.length)];
  } else {
    const words = text.split(/\s+/);
    if (words.length > 8) {
      const mid = Math.ceil(words.length / 2);
      title = words.slice(0, mid).join(" ");
      subtitle = words.slice(mid).join(" ");
    } else if (words.length > 3) {
      title = text;
      subtitle = tmpl.slogans[Math.floor(Math.random() * tmpl.slogans.length)];
    } else {
      title = text.toUpperCase();
      subtitle = tmpl.slogans[Math.floor(Math.random() * tmpl.slogans.length)];
    }
    detail = "";
    tag = tmpl.tags[Math.floor(Math.random() * tmpl.tags.length)];
  }

  return { title, subtitle, detail, tag, slogan: tmpl.slogans[0] };
}

// ─── Generate animated title card ───────────────────────────────────────
async function generateAIClip({ prompt, workDir, templateKey, duration }) {
  fs.mkdirSync(workDir, { recursive: true });
  ensureFonts();

  const out = path.join(workDir, `ai_${Date.now()}.mp4`);
  const ffmpeg = findFFmpeg();
  const dur = duration || 3;

  const tmpl = SCENE_TEMPLATES[templateKey] || SCENE_TEMPLATES.security;
  const scene = parsePrompt(prompt || "AI Generated Content", templateKey);

  const font = "output/fonts/arial.ttf";
  const fontBold = "output/fonts/arialbd.ttf";

  // Build complex animated filter
  const filters = [];

  // Background grid
  if (tmpl.grid) filters.push(tmpl.grid);

  // Tag label (top-left, small, animated fade-in)
  filters.push(
    `drawtext=fontfile=${font}:text='${escapeText(scene.tag)}':fontcolor=${tmpl.accent}@0.6:fontsize=18:x=40:y=40:enable='between(t,0.2,${dur})'`
  );

  // Horizontal line separator (top area)
  filters.push(
    `drawbox=x=40:y=70:w=600:h=1:color=${tmpl.accent}@0.3:t=fill:enable='between(t,0.3,${dur})'`
  );

  // Main title (center, large, animated)
  const titleFontSize = Math.round(1080 * 0.065);
  filters.push(
    `drawtext=fontfile=${fontBold}:text='${escapeText(scene.title)}':fontcolor=${tmpl.accent}:fontsize=${titleFontSize}:x=(w-text_w)/2:y=(h/2)-60:enable='between(t,0.4,${dur})'`
  );

  // Subtitle (below title, smaller, delayed)
  if (scene.subtitle) {
    const subFontSize = Math.round(1080 * 0.03);
    filters.push(
      `drawtext=fontfile=${font}:text='${escapeText(scene.subtitle)}':fontcolor=${tmpl.text}@0.8:fontsize=${subFontSize}:x=(w-text_w)/2:y=(h/2)+30:enable='between(t,0.7,${dur})'`
    );
  }

  // Detail / bottom text (smallest, latest)
  if (scene.detail) {
    const detFontSize = Math.round(1080 * 0.02);
    filters.push(
      `drawtext=fontfile=${font}:text='${escapeText(scene.detail)}':fontcolor=${tmpl.accent2}:fontsize=${detFontSize}:x=(w-text_w)/2:y=(h/2)+80:enable='between(t,1.0,${dur})'`
    );
  }

  // Bottom watermark / branding
  const brandFontSize = Math.round(1080 * 0.015);
  filters.push(
    `drawtext=fontfile=${font}:text='${escapeText(scene.slogan)}':fontcolor=${tmpl.text}@0.3:fontsize=${brandFontSize}:x=(w-text_w)/2:y=h-60:enable='between(t,1.2,${dur})'`
  );

  // Vignette effect for cinematic look
  filters.push("vignette=PI/4");

  const vf = filters.join(",");

  await run(ffmpeg, [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${tmpl.bg}:s=1920x1080:d=${dur}:r=30`,
    "-vf", vf,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-fps_mode", "cfr",
    "-t", String(dur),
    out
  ]);

  return out;
}

// ─── Get available templates ────────────────────────────────────────────
function getTemplates() {
  return Object.keys(SCENE_TEMPLATES).map(key => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    accent: SCENE_TEMPLATES[key].accent,
    tags: SCENE_TEMPLATES[key].tags.slice(0, 5),
  }));
}

module.exports = { generateAIClip, getTemplates, SCENE_TEMPLATES };
