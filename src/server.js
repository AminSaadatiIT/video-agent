const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const { renderProject } = require("./renderer");
const { generateAIClip } = require("./ai-providers");

// --- Detect ffmpeg path (local ./ffmpeg/bin or system) ---
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
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 300 * 1024 * 1024 } });

// in-memory job store (swap for redis/db in production)
const jobs = new Map();

// ---- Render a project from uploaded files + a JSON "timeline" ----
// timeline: [{ type: 'image'|'video'|'ai', text, duration, fileIndex? , aiPrompt? }]
app.post("/api/render", upload.any(), async (req, res) => {
  try {
    const jobId = uuidv4();
    const timeline = JSON.parse(req.body.timeline || "[]");
    const options = JSON.parse(req.body.options || "{}");
    const files = req.files || [];

    jobs.set(jobId, { status: "processing", progress: 0 });
    res.json({ jobId });

    const workDir = path.join(OUTPUT_DIR, jobId);
    const outPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);

    const items = [];
    for (const step of timeline) {
      if (step.type === "ai") {
        // Pluggable AI generation hook — see src/ai-providers.js
        const aiClipPath = await generateAIClip({ prompt: step.aiPrompt, workDir });
        items.push({ type: "video", path: aiClipPath, text: step.text, duration: step.duration });
      } else {
        const file = files[step.fileIndex];
        if (!file) continue;
        items.push({ type: step.type, path: file.path, text: step.text, duration: step.duration });
      }
    }

    await renderProject({ items, options, workDir, outPath });

    jobs.set(jobId, { status: "done", progress: 100, file: `${jobId}.mp4` });

    // cleanup uploaded originals
    for (const f of files) {
      try { fs.unlinkSync(f.path); } catch (_) {}
    }
    try { fs.rmdirSync(workDir); } catch (_) {}
  } catch (err) {
    console.error(err);
    const jobId = [...jobs.keys()].pop();
    jobs.set(jobId, { status: "error", error: err.message });
  }
});

app.get("/api/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

app.get("/api/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done") return res.status(404).json({ error: "not ready" });
  res.download(path.join(OUTPUT_DIR, job.file));
});

// ---- Embeddable player page: <iframe src="/embed/:jobId"> works on ANY external site ----
app.get("/embed/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done") {
    return res.send(`<html><body style="background:#0a0e17;color:#00e5ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">در حال آماده‌سازی ویدیو…</body></html>`);
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ffmpeg: !!FFMPEG_PATH, jobs: jobs.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        🎬 VIDEO AGENT RUNNING            ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`  🌐 Open: http://localhost:${PORT}`);
  console.log(`  🔧 ffmpeg: ${FFMPEG_PATH ? "✅ local (./ffmpeg/bin)" : "✅ system"}`);
  console.log("");
});
