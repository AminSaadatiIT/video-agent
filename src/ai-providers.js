// ═══════════════════════════════════════════════════════════════════════════
// AI VIDEO AGENT — Complete Professional Content Generator
// Parses ANY prompt, generates multi-scene professional videos
// ═══════════════════════════════════════════════════════════════════════════
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const P = path.join(__dirname, "..");

// ─── FONTS ────────────────────────────────────────────────────────────────
function ensureFonts() {
  const fd = path.join(P, "output", "fonts");
  fs.mkdirSync(fd, { recursive: true });
  var fontMap = { "arial.ttf": "C:/Windows/Fonts/arial.ttf", "arialbd.ttf": "C:/Windows/Fonts/arialbd.ttf" };
  for (var name in fontMap) {
    var dest = path.join(fd, name);
    if (!fs.existsSync(dest)) {
      try {
        var src = fontMap[name];
        if (fs.existsSync(src)) {
          var data = fs.readFileSync(src);
          fs.writeFileSync(dest, data);
        }
      } catch (_) {}
    }
  }
}

function ffmpeg() {
  const l = path.join(P, "ffmpeg", "bin", "ffmpeg.exe");
  return fs.existsSync(l) ? l : "ffmpeg";
}

function ffprobe() {
  const l = path.join(P, "ffmpeg", "bin", "ffprobe.exe");
  return fs.existsSync(l) ? l : "ffprobe";
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: P });
    let e = "";
    p.stderr.on("data", d => { if (e.length < 16384) e += d.toString(); });
    p.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg " + c + "\n" + e.slice(-2000))));
  });
}

// ─── THEMES ───────────────────────────────────────────────────────────────
const THEMES = {
  security:  { bg: "0x0a0e17", ac: "0x00e5ff", ac2: "0x39ff88", tx: "0xe8f6ff", name: "Cybersecurity" },
  corporate: { bg: "0x0f172a", ac: "0x3b82f6", ac2: "0x10b981", tx: "0xf1f5f9", name: "Corporate" },
  tech:      { bg: "0x050510", ac: "0x8b5cf6", ac2: "0x06b6d4", tx: "0xe2e8f0", name: "Technology" },
  minimal:   { bg: "0x18181b", ac: "0xfafafa", ac2: "0xa1a1aa", tx: "0xfafafa", name: "Minimal" },
  bold:      { bg: "0x1a0000", ac: "0xff3860", ac2: "0xff9f43", tx: "0xfff1f2", name: "Bold" },
  nature:    { bg: "0x0a1a0a", ac: "0x22c55e", ac2: "0x84cc16", tx: "0xf0fdf4", name: "Nature" },
  gold:      { bg: "0x1a1505", ac: "0xf59e0b", ac2: "0xd97706", tx: "0xfef3c7", name: "Gold" },
};

// ─── TEXT ESCAPING ────────────────────────────────────────────────────────
// ffmpeg drawtext filter special chars: : , % ' [ ] ;
// On Windows spawn(), backslash escaping does NOT work — replace chars instead
function esc(t) {
  if (!t) return "";
  var s = String(t);
  s = s.replace(/\\/g, "");
  s = s.replace(/:/g, " -");
  s = s.replace(/%/g, "pct");
  s = s.replace(/'/g, "\u2019");
  s = s.replace(/,/g, " -");
  s = s.replace(/;/g, ".");
  s = s.replace(/[\[\]]/g, "");
  return s;
}

// ─── PROMPT ANALYZER (The Brain) ──────────────────────────────────────────
// Analyzes ANY prompt and extracts structured content for video generation
function analyzePrompt(prompt) {
  var p = (prompt || "").trim();
  var low = p.toLowerCase();

  // Domain detection — maps keywords to professional content domains
  var domains = {
    security: {
      keywords: ["security", "firewall", "pentest", "penetration", "vulnerability", "vuln", "cve", "threat", "attack", "malware", "ransomware", "phishing", "soc", "siem", "ids", "ips", "encryption", "zero trust", "compliance", "gdpr", "iso 27001", "nist"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "SECURITY ANALYSIS", sub: t.subtitle || "Comprehensive Assessment", dur: 4 },
          { type: "bullets", text: "THREAT LANDSCAPE", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "KEY METRICS", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "RECOMMENDATIONS", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "SECURITY POSTURE STRONG", sub: t.cta || "Action Required", dur: 3 },
        ];
      }
    },
    infrastructure: {
      keywords: ["infrastructure", "network", "server", "datacenter", "dc", "vm", "container", "docker", "kubernetes", "k8s", "cloud", "aws", "azure", "gcp", "cdn", "dns", "load balancer", "bandwidth", "latency", "uptime", "sla"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "INFRASTRUCTURE REVIEW", sub: t.subtitle || "Architecture Assessment", dur: 4 },
          { type: "bullets", text: "INFRASTRUCTURE OVERVIEW", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "PERFORMANCE METRICS", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "OPTIMIZATION PLAN", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "INFRASTRUCTURE OPTIMIZED", sub: t.cta || "Next Steps", dur: 3 },
        ];
      }
    },
    business: {
      keywords: ["business", "strategy", "marketing", "sales", "revenue", "roi", "growth", "customer", "product", "startup", "enterprise", "quarter", "q1", "q2", "q3", "q4", "annual", "fiscal", "profit", "market"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "BUSINESS STRATEGY", sub: t.subtitle || "Strategic Overview", dur: 4 },
          { type: "bullets", text: "KEY INITIATIVES", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "KPI DASHBOARD", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "ACTION ITEMS", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "STRATEGY ALIGNED", sub: t.cta || "Execute Now", dur: 3 },
        ];
      }
    },
    health: {
      keywords: ["health", "medical", "patient", "clinical", "diagnosis", "treatment", "pharma", "biotech", "hospital", "care", "wellness", "fitness", "nutrition"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "HEALTH REPORT", sub: t.subtitle || "Clinical Assessment", dur: 4 },
          { type: "bullets", text: "FINDINGS", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "VITAL METRICS", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "RECOMMENDATIONS", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "HEALTH OPTIMIZED", sub: t.cta || "Follow Up", dur: 3 },
        ];
      }
    },
    education: {
      keywords: ["education", "learning", "course", "training", "curriculum", "student", "teacher", "university", "school", "lecture", "workshop", "certification"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "EDUCATION PROGRAM", sub: t.subtitle || "Learning Overview", dur: 4 },
          { type: "bullets", text: "PROGRAM HIGHLIGHTS", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "OUTCOMES", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "NEXT STEPS", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "KNOWLEDGE EMPOWERED", sub: t.cta || "Enroll Now", dur: 3 },
        ];
      }
    },
    finance: {
      keywords: ["finance", "investment", "portfolio", "stock", "crypto", "bitcoin", "trading", "banking", "loan", "credit", "budget", "forecast", "quarterly"],
      scenes: function(t) {
        return [
          { type: "title", text: t.title || "FINANCIAL ANALYSIS", sub: t.subtitle || "Market Overview", dur: 4 },
          { type: "bullets", text: "MARKET INSIGHTS", items: t.points.slice(0, 4), dur: 4 },
          { type: "metrics", text: "PERFORMANCE", metrics: t.metrics, dur: 4 },
          { type: "bullets", text: "INVESTMENT STRATEGY", items: t.recommendations, dur: 4 },
          { type: "cta", text: t.conclusion || "PORTFOLIO OPTIMIZED", sub: t.cta || "Act Now", dur: 3 },
        ];
      }
    },
  };

  // Detect domain
  var detectedDomain = null;
  var maxScore = 0;
  for (var [dk, dv] of Object.entries(domains)) {
    var score = 0;
    for (var kw of dv.keywords) {
      if (low.includes(kw)) score += kw.length;
    }
    if (score > maxScore) { maxScore = score; detectedDomain = dk; }
  }

  // Extract key phrases — split by common delimiters
  var phrases = p.split(/[,;.!?|+\-–—\n]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 2; });
  if (phrases.length === 0) phrases = [p];

  // Build title from prompt
  var title = phrases[0].toUpperCase().substring(0, 40);
  var subtitle = phrases.length > 1 ? phrases[1].substring(0, 50) : detectedDomain ? domains[detectedDomain].name + " Analysis" : "Professional Report";

  // Generate points from phrases
  var points = [];
  for (var i = 0; i < Math.min(phrases.length, 8); i++) {
    points.push(phrases[i].substring(0, 60));
  }
  // Pad if too few
  while (points.length < 4) points.push("Analysis " + (points.length + 1) + " - Detailed findings");

  // Generate metrics from numbers in prompt
  var numbers = p.match(/\d+\.?\d*/g) || [];
  var metrics = [];
  var metricLabels = ["Score", "Rating", "Level", "Index", "Value", "Score", "Rating", "Level"];
  for (var mi = 0; mi < Math.min(numbers.length, 6); mi++) {
    metrics.push({ label: metricLabels[mi] || "Metric", value: numbers[mi] });
  }
  if (metrics.length === 0) {
    metrics = [
      { label: "Score", value: "92" },
      { label: "Rating", value: "A+" },
      { label: "Status", value: "OK" }
    ];
  }

  // Generate recommendations
  var recommendations = [
    "Implement findings from " + title.substring(0, 30),
    "Schedule follow-up review within 30 days",
    "Document all changes and track progress",
    "Share report with stakeholders"
  ];

  // Build scenes
  var scenes;
  if (detectedDomain && domains[detectedDomain]) {
    scenes = domains[detectedDomain].scenes({
      title: title, subtitle: subtitle,
      points: points, metrics: metrics,
      recommendations: recommendations,
      conclusion: title.substring(0, 35) + " COMPLETE",
      cta: "Review and approve"
    });
  } else {
    // Generic scenes for any prompt
    scenes = [
      { type: "title", text: title, sub: subtitle, dur: 4 },
      { type: "bullets", text: "KEY POINTS", items: points.slice(0, 4), dur: 4 },
      { type: "metrics", text: "ANALYSIS METRICS", metrics: metrics, dur: 4 },
      { type: "bullets", text: "FINDINGS", items: points.slice(4, 8), dur: 4 },
      { type: "cta", text: title.substring(0, 35) + " ANALYSIS COMPLETE", sub: "Review and approve", dur: 3 },
    ];
  }

  return { domain: detectedDomain, scenes: scenes, title: title, subtitle: subtitle };
}

// ─── SCENE RENDERERS (The Visual Engine) ──────────────────────────────────
// Each scene type has its own professional layout with animated effects

function buildTitleScene(text, sub, th, dur) {
  var filters = [];
  // Grid background
  filters.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  // Accent line top
  filters.push("drawbox=x=0:y=0:w=(iw):h=4:color=" + th.ac + ":t=fill");
  // REPORT label
  filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc("REPORT") + ":fontcolor=" + th.ac + "@0.4:fontsize=14:x=80:y=60");
  // Horizontal line under label
  filters.push("drawbox=x=80:y=82:w=120:h=2:color=" + th.ac + ":t=fill");
  // Main title (large, centered)
  filters.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=72:x=(w-text_w)/2:y=(h/2)-100");
  // Subtitle
  if (sub) {
    filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(sub) + ":fontcolor=" + th.tx + "@0.7:fontsize=28:x=(w-text_w)/2:y=(h/2)+10");
  }
  // Decorative line under title
  filters.push("drawbox=x=(w/2)-100:y=(h/2)+50:w=200:h=2:color=" + th.ac + "@0.5:t=fill");
  // Bottom accent bar
  filters.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  // Vignette
  filters.push("vignette=PI/4");
  return filters.join(",");
}

function buildBulletsScene(text, items, th, dur) {
  var filters = [];
  // Grid background
  filters.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  // Left accent bar
  filters.push("drawbox=x=0:y=0:w=6:h=1080:color=" + th.ac + ":t=fill");
  // Section header
  filters.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=80:y=60");
  // Header underline
  filters.push("drawbox=x=80:y=115:w=500:h=2:color=" + th.ac + "@0.4:t=fill");
  // Bullet points
  var startY = 160;
  for (var i = 0; i < items.length && i < 6; i++) {
    var y = startY + i * 110;
    // Bullet dot
    filters.push("drawbox=x=80:y=" + (y + 12) + ":w=8:h=8:color=" + th.ac2 + ":t=fill");
    // Bullet text
    filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(items[i]) + ":fontcolor=" + th.tx + "@0.9:fontsize=30:x=104:y=" + y);
    // Subtle line under bullet
    if (i < items.length - 1) {
      filters.push("drawbox=x=104:y=" + (y + 70) + ":w=800:h=1:color=" + th.ac + "@0.1:t=fill");
    }
  }
  // Bottom bar
  filters.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  // Vignette
  filters.push("vignette=PI/4");
  return filters.join(",");
}

function buildMetricsScene(text, metrics, th, dur) {
  var filters = [];
  // Grid background
  filters.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  // Section header
  filters.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=80:y=60");
  filters.push("drawbox=x=80:y=115:w=400:h=2:color=" + th.ac + "@0.4:t=fill");
  // Metric cards in grid layout
  var cols = Math.min(metrics.length, 3);
  var rows = Math.ceil(metrics.length / cols);
  var cardW = 480;
  var cardH = 180;
  var gapX = 40;
  var gapY = 40;
  var startX = (1920 - (cols * cardW + (cols - 1) * gapX)) / 2;
  var startY = 180;

  for (var i = 0; i < metrics.length; i++) {
    var col = i % cols;
    var row = Math.floor(i / cols);
    var x = startX + col * (cardW + gapX);
    var y = startY + row * (cardH + gapY);
    var m = metrics[i];

    // Card background
    filters.push("drawbox=x=" + x + ":y=" + y + ":w=" + cardW + ":h=" + cardH + ":color=" + th.ac + "@0.08:t=fill");
    // Card border
    filters.push("drawbox=x=" + x + ":y=" + y + ":w=" + cardW + ":h=2:color=" + th.ac + "@0.3:t=fill");
    // Metric value (large)
    filters.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(String(m.value)) + ":fontcolor=" + th.ac + ":fontsize=64:x=" + (x + cardW / 2) + "-(text_w/2):y=" + (y + 40));
    // Metric label
    filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(m.label) + ":fontcolor=" + th.tx + "@0.6:fontsize=20:x=" + (x + cardW / 2) + "-(text_w/2):y=" + (y + 120));
  }
  // Bottom bar
  filters.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  // Vignette
  filters.push("vignette=PI/4");
  return filters.join(",");
}

function buildCtaScene(text, sub, th, dur) {
  var filters = [];
  // Grid background
  filters.push("drawgrid=w=96:h=54:t=1:c=" + th.ac2 + "@0.06");
  // Large centered text
  filters.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=56:x=(w-text_w)/2:y=(h/2)-60");
  // Subtitle
  if (sub) {
    filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(sub) + ":fontcolor=" + th.tx + "@0.7:fontsize=24:x=(w-text_w)/2:y=(h/2)+20");
  }
  // Decorative lines
  filters.push("drawbox=x=(w/2)-120:y=(h/2)+60:w=240:h=2:color=" + th.ac + ":t=fill");
  // Video Agent branding
  filters.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc("VIDEO AGENT") + ":fontcolor=" + th.tx + "@0.15:fontsize=12:x=(w-text_w)/2:y=(h-40)");
  // Top accent bar
  filters.push("drawbox=x=0:y=0:w=(iw):h=4:color=" + th.ac + ":t=fill");
  // Vignette
  filters.push("vignette=PI/4");
  return filters.join(",");
}

// ─── SCENE GENERATOR ──────────────────────────────────────────────────────
async function renderScene(sceneDef, theme, workDir, index) {
  var ff = ffmpeg();
  var th = THEMES[theme] || THEMES.security;
  var dur = sceneDef.dur || 4;
  var filters;

  switch (sceneDef.type) {
    case "title":
      filters = buildTitleScene(sceneDef.text, sceneDef.sub, th, dur);
      break;
    case "bullets":
      filters = buildBulletsScene(sceneDef.text, sceneDef.items || [], th, dur);
      break;
    case "metrics":
      filters = buildMetricsScene(sceneDef.text, sceneDef.metrics || [], th, dur);
      break;
    case "cta":
      filters = buildCtaScene(sceneDef.text, sceneDef.sub, th, dur);
      break;
    default:
      filters = buildBulletsScene(sceneDef.text, sceneDef.items || [], th, dur);
  }

  var out = path.join(workDir, "_s" + index + ".mp4");
  try {
    await run(ff, [
      "-y", "-f", "lavfi", "-i",
      "color=c=" + th.bg + ":s=1920x1080:d=" + dur + ":r=30",
      "-filter_complex", filters,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-r", "30", "-fps_mode", "cfr", "-t", String(dur),
      out
    ]);
  } catch (renderErr) {
    throw renderErr;
  }
  return out;
}

// ─── CONCATENATION ────────────────────────────────────────────────────────
async function concatScenes(scenes, out) {
  var ff = ffmpeg();
  if (scenes.length === 1) {
    await run(ff, ["-v", "error", "-y", "-i", scenes[0], "-c", "copy", out]);
    return;
  }
  var probe = ffprobe();
  var durations = [];
  for (var si = 0; si < scenes.length; si++) {
    var p = spawn(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", scenes[si]]);
    var o = "";
    p.stdout.on("data", function(d) { o += d.toString(); });
    await new Promise(function(r) { p.on("close", r); });
    durations.push(parseFloat(o.trim()) || 3);
  }
  // Build xfade filter chain
  var filter = "";
  var lastLabel = "0:v";
  var cumulativeOffset = durations[0];
  var ins = [];
  scenes.forEach(function(s) { ins.push("-i", s); });
  for (var i = 1; i < scenes.length; i++) {
    var xfadeDur = 0.8;
    var offset = cumulativeOffset - xfadeDur;
    var outLabel = i === scenes.length - 1 ? "vout" : "v" + i;
    filter += "[" + lastLabel + "][" + i + ":v]xfade=transition=fade:duration=" + xfadeDur + ":offset=" + offset.toFixed(2) + "[" + outLabel + "];";
    lastLabel = outLabel;
    cumulativeOffset += durations[i] - xfadeDur;
  }
  await run(ff, ["-v", "error", "-y"].concat(ins).concat([
    "-filter_complex", filter.replace(/;$/, ""),
    "-map", "[vout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", out
  ]));
}

// ─── MAIN AI AGENT ────────────────────────────────────────────────────────
async function generateAIClip({ prompt, workDir, templateKey, duration }) {
  fs.mkdirSync(workDir, { recursive: true });
  ensureFonts();

  // Analyze the prompt — this is where the AI brain works
  var analysis = analyzePrompt(prompt);

  // Determine total duration and per-scene duration
  var totalDuration = duration || (analysis.scenes.length * 4);
  var perSceneDur = totalDuration / analysis.scenes.length;

  // Adjust scene durations to fit total
  var remaining = totalDuration;
  for (var i = 0; i < analysis.scenes.length; i++) {
    if (i === analysis.scenes.length - 1) {
      analysis.scenes[i].dur = Math.max(2, remaining);
    } else {
      analysis.scenes[i].dur = perSceneDur;
      remaining -= perSceneDur;
    }
  }

  // Render each scene (with retry on failure)
  var scenePaths = [];
  for (var si = 0; si < analysis.scenes.length; si++) {
    var retries = 0;
    while (retries < 3) {
      try {
        await renderScene(analysis.scenes[si], templateKey || "security", workDir, si);
        break;
      } catch (err) {
        retries++;
        if (retries >= 3) {
          console.error("Scene " + si + " (" + analysis.scenes[si].type + ") failed after 3 attempts:", err.message.substring(0, 300));
          throw err;
        }
        // Wait before retry
        await new Promise(function(r) { setTimeout(r, 500 * retries); });
      }
    }
    scenePaths.push(path.join(workDir, "_s" + si + ".mp4"));
  }

  // Concatenate with crossfade transitions
  var out = path.join(workDir, "ai_" + Date.now() + ".mp4");
  await concatScenes(scenePaths, out);

  // Cleanup temp scenes
  for (var ci = 0; ci < scenePaths.length; ci++) {
    try { fs.unlinkSync(scenePaths[ci]); } catch (_) {}
  }

  return out;
}

// ─── API ──────────────────────────────────────────────────────────────────
function getTemplates() {
  return Object.keys(THEMES).map(function(k) {
    return { id: k, name: THEMES[k].name, accent: THEMES[k].ac };
  });
}

module.exports = { generateAIClip, getTemplates, THEMES, analyzePrompt };
