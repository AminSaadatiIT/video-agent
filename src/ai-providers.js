// ---------------------------------------------------------------------------
// Pluggable AI clip generator.
//
// This is a stub adapter: it lets the rest of the app treat "AI-generated"
// timeline steps the same as uploaded video steps. To make it real, wire it
// to whatever provider you use (Runway, Pika, Luma, an image API + Ken Burns,
// a TTS API for voiceover, etc.).
//
// IMPORTANT: never hardcode API keys in this file. Put them in a local
// .env file (see .env.example) and read them with process.env.YOUR_KEY.
// .env is already excluded via .gitignore.
// ---------------------------------------------------------------------------

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

async function generateAIClip({ prompt, workDir }) {
  const apiKey = process.env.AI_VIDEO_API_KEY;

  if (!apiKey) {
    // Fallback so the pipeline still works end-to-end without a real key:
    // renders a placeholder "AI SEGMENT" title card instead of failing.
    return renderPlaceholder(prompt, workDir);
  }

  // Example shape for wiring a real provider (pseudo-code — replace with
  // your provider's actual REST call and polling/webhook flow):
  //
  // const res = await fetch("https://api.yourprovider.com/v1/generate", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${apiKey}`,
  //     "Content-Type": "application/json"
  //   },
  //   body: JSON.stringify({ prompt })
  // });
  // const { videoUrl } = await res.json();
  // download videoUrl to workDir and return that local path.

  return renderPlaceholder(prompt, workDir); // replace once a provider is wired
}

function renderPlaceholder(prompt, workDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(workDir, { recursive: true });
    const out = path.join(workDir, `ai_${Date.now()}.mp4`);
    const font = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf";
    const text = (prompt || "AI SEGMENT").replace(/'/g, "\u2019").replace(/:/g, "\\:");
    const p = spawn("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "color=c=0x0a0e17:s=1920x1080:d=3:r=30",
      "-vf", `drawtext=fontfile=${font}:text='${text}':fontcolor=0x39ff88:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-vsync", "cfr", out
    ]);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error("placeholder render failed"))));
  });
}

module.exports = { generateAIClip };
