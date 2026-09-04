require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const { renderProject, FILTERS, TRANSITIONS } = require("./renderer");
const { generateAIClip, getTemplates } = require("./ai-providers");

// --- Detect ffmpeg path ---
function findFFmpeg() {
  const localBin = path.join(__dirname, "..", "ffmpeg", "bin");
  if (fs.existsSync(path.join(localBin, "ffmpeg.exe"))) return localBin;
  if (fs.existsSync(path.join(localBin, "ffmpeg"))) return localBin;
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return ""; } catch {}
  return null;
}
const FFMPEG_PATH = findFFmpeg();
if (FFMPEG_PATH) process.env.PATH = FFMPEG_PATH + path.delimiter + (process.env.PATH || "");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 300 * 1024 * 1024 } });

// In-memory job store
const jobs = new Map();

// ─── POST /api/render ───────────────────────────────────────────────────
app.post("/api/render", upload.any(), async (req, res) => {
  try {
    const jobId = uuidv4();
    const timeline = JSON.parse(req.body.timeline || "[]");
    const options = JSON.parse(req.body.options || "{}");
    const files = req.files || [];

    jobs.set(jobId, { status: "processing", progress: 0, step: "Starting..." });
    res.json({ jobId });

    const workDir = path.join(OUTPUT_DIR, jobId);
    const outPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);

    const items = [];
    for (const step of timeline) {
      if (step.type === "ai") {
        let aiClipPath;
        // Check if pre-generated AI video URL is provided
        if (step.aiVideoUrl) {
          // Download pre-generated video from our own server
          const urlParts = step.aiVideoUrl.split('/');
          const aiJobId = urlParts[urlParts.length - 1];
          const aiJob = jobs.get(aiJobId);
          if (aiJob && aiJob.status === 'done' && aiJob.file) {
            aiClipPath = path.join(OUTPUT_DIR, aiJob.file);
          }
        }
        // Generate if not pre-generated
        if (!aiClipPath || !fs.existsSync(aiClipPath)) {
          aiClipPath = await generateAIClip({
            prompt: step.aiPrompt,
            workDir,
            templateKey: step.aiTemplate || "security",
            duration: step.duration || 12,
          });
        }
        items.push({
          type: "video", path: aiClipPath,
          text: step.text, subtitle: step.subtitle,
          duration: step.duration,
          effects: step.effects || {},
        });
      } else {
        const file = files[step.fileIndex];
        if (!file) continue;
        items.push({
          type: step.type, path: file.path,
          text: step.text, subtitle: step.subtitle,
          duration: step.duration,
          effects: step.effects || {},
        });
      }
    }

    await renderProject({
      items, options, workDir, outPath,
      progress: (pct, msg) => {
        const job = jobs.get(jobId);
        if (job) { job.progress = pct; job.step = msg; }
      }
    });

    jobs.set(jobId, { status: "done", progress: 100, file: `${jobId}.mp4` });

    // Cleanup uploaded originals
    for (const f of files) {
      try { fs.unlinkSync(f.path); } catch (_) {}
    }
  } catch (err) {
    console.error(err);
    const jobId = [...jobs.keys()].pop();
    jobs.set(jobId, { status: "error", error: err.message });
  }
});

// ─── GET /api/status/:jobId ─────────────────────────────────────────────
app.get("/api/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

// ─── GET /api/download/:jobId ───────────────────────────────────────────
app.get("/api/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done") return res.status(404).json({ error: "not ready" });
  res.download(path.join(OUTPUT_DIR, job.file));
});

// ─── GET /embed/:jobId ──────────────────────────────────────────────────
app.get("/embed/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done") {
    return res.send(`<html><body style="background:#0a0e17;color:#00e5ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">Loading…</body></html>`);
  }
  res.send(`<!DOCTYPE html>
<html><head><style>
  html,body{margin:0;background:#000;height:100%}
  video{width:100%;height:100%;object-fit:contain}
</style></head>
<body>
  <video src="/output/${job.file}" controls autoplay muted playsinline></video>
</body></html>`);
});

app.use("/output", express.static(OUTPUT_DIR));

// ─── GET /api/templates ─────────────────────────────────────────────────
app.get("/api/templates", (req, res) => {
  res.json(getTemplates());
});

// ─── GET /api/filters ───────────────────────────────────────────────────
app.get("/api/filters", (req, res) => {
  res.json(Object.keys(FILTERS).map(k => ({ id: k, name: k })));
});

// ─── GET /api/transitions ───────────────────────────────────────────────
app.get("/api/transitions", (req, res) => {
  res.json(Object.keys(TRANSITIONS).map(k => ({ id: k, name: k })));
});

// ─── GET /api/health ────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ffmpeg: !!FFMPEG_PATH, jobs: jobs.size });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     🎬 VIDEO AGENT — PROFESSIONAL EDITION    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log(`  🌐 Open: http://localhost:${PORT}`);
  console.log(`  🔧 ffmpeg: ${FFMPEG_PATH ? "✅ local (./ffmpeg/bin)" : "✅ system"}`);
  console.log(`  🎨 Filters: ${Object.keys(FILTERS).length}`);
  console.log(`  🔀 Transitions: ${Object.keys(TRANSITIONS).length}`);
  console.log(`  🤖 AI Templates: ${getTemplates().length}`);
  console.log("");
});
