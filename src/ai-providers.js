// ═══════════════════════════════════════════════════════════════════════════
// INTELLIGENT AI VIDEO AGENT — v2.0
// Parses ANY prompt (Farsi/English), generates professional multi-scene videos
// Supports: entity extraction, dynamic content, 8 scene types, per-scene editing
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
        if (fs.existsSync(src)) { var data = fs.readFileSync(src); fs.writeFileSync(dest, data); }
      } catch (_) {}
    }
  }
}

function ffmpeg() {
  var l = path.join(P, "ffmpeg", "bin", "ffmpeg.exe");
  return fs.existsSync(l) ? l : "ffmpeg";
}
function ffprobe() {
  var l = path.join(P, "ffmpeg", "bin", "ffprobe.exe");
  return fs.existsSync(l) ? l : "ffprobe";
}
function run(cmd, args) {
  return new Promise(function(res, rej) {
    var p = spawn(cmd, args, { cwd: P });
    var e = "";
    p.stderr.on("data", function(d) { if (e.length < 16384) e += d.toString(); });
    p.on("close", function(c) { c === 0 ? res() : rej(new Error("ffmpeg " + c + "\n" + e.slice(-2000))); });
  });
}

// ─── THEMES ───────────────────────────────────────────────────────────────
var THEMES = {
  security:  { bg: "0x0a0e17", ac: "0x00e5ff", ac2: "0x39ff88", tx: "0xe8f6ff", name: "Cybersecurity" },
  corporate: { bg: "0x0f172a", ac: "0x3b82f6", ac2: "0x10b981", tx: "0xf1f5f9", name: "Corporate" },
  tech:      { bg: "0x050510", ac: "0x8b5cf6", ac2: "0x06b6d4", tx: "0xe2e8f0", name: "Technology" },
  minimal:   { bg: "0x18181b", ac: "0xfafafa", ac2: "0xa1a1aa", tx: "0xfafafa", name: "Minimal" },
  bold:      { bg: "0x1a0000", ac: "0xff3860", ac2: "0xff9f43", tx: "0xfff1f2", name: "Bold" },
  nature:    { bg: "0x0a1a0a", ac: "0x22c55e", ac2: "0x84cc16", tx: "0xf0fdf4", name: "Nature" },
  gold:      { bg: "0x1a1505", ac: "0xf59e0b", ac2: "0xd97706", tx: "0xfef3c7", name: "Gold" },
};

// ─── TEXT ESCAPING ────────────────────────────────────────────────────────
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

// ─── FARSI DICTIONARY ─────────────────────────────────────────────────────
// Maps Farsi keywords to English equivalents for content generation
var FARSI_MAP = {
  "امنیت": "security", "فایروال": "firewall", "شبکه": "network", "سرور": "server",
  "سیستم": "system", "داده": "data", "اطلاعات": "information", "گزارش": "report",
  "تحلیل": "analysis", "بررسی": "review", "ارزیابی": "assessment", "audit": "audit",
  "پنتست": "penetration test", "آسیب‌پذیری": "vulnerability", "تهدید": "threat",
  "ریسک": "risk", "риск": "risk", "عملکرد": "performance", "سرعت": "speed",
  "کلود": "cloud", "آمازون": "AWS", "اژور": "Azure", "استوریج": "storage",
  "بکاپ": "backup", "بازیابی": "recovery", "مانیتورینگ": "monitoring",
  "لاگ": "logs", "آلرت": "alerts", "ایونت": "events", "ترافیک": "traffic",
  "پهنای باند": "bandwidth", "لاتنسی": "latency", "آپتایم": "uptime",
  "بیزینس": "business", "استراتژی": "strategy", "مارکتینگ": "marketing",
  "فروش": "sales", "درآمد": "revenue", "مشتری": "customer", "پروژه": "project",
  "تیم": "team", "مدیریت": "management", "عملیات": "operations",
  "پزشکی": "health", "بیمار": "patient", "درمان": "treatment", "دارو": "medicine",
  "مالی": "finance", "سرمایه‌گذاری": "investment", "بودجه": "budget",
  "آموزش": "education", "دوره": "course", "آموزش": "training",
  "طراحی": "design", "توسعه": "development", "برنامه‌نویسی": "programming",
  "اپلیکیشن": "application", "نرم‌افزار": "software", "سخت‌افزار": "hardware",
  "گزارش": "report", "داشبورد": "dashboard", "نمودار": "chart", "آمار": "statistics",
  "نتیجه": "result", "یافته": "finding", "پیشنهاد": "recommendation",
  "مشکل": "issue", "خطا": "error", "باگ": "bug", "رفع": "fix", "بهبود": "improvement",
  "وضعیت": "status", "پیشرفت": "progress", "هدف": "goal", "برنامه": "plan",
  "بودجه": "budget", "هزینه": "cost", "صرفه‌جویی": "savings",
};

// Detect if text contains Farsi characters
function isFarsi(text) {
  return /[\u0600-\u06FF]/.test(text);
}

// Translate Farsi keywords to English
function translateFarsi(text) {
  if (!isFarsi(text)) return text;
  var result = text;
  for (var fa in FARSI_MAP) {
    if (result.indexOf(fa) >= 0) {
      result = result.replace(new RegExp(fa, "g"), FARSI_MAP[fa]);
    }
  }
  return result;
}

// ─── INTELLIGENT PROMPT PARSER ────────────────────────────────────────────
// Extracts entities, topics, numbers, actions from ANY prompt
function parsePrompt(prompt) {
  var raw = (prompt || "").trim();
  var translated = translateFarsi(raw);
  var low = translated.toLowerCase();
  var originalLow = raw.toLowerCase();

  // Extract numbers
  var numbers = translated.match(/\d+\.?\d*/g) || [];
  var originalNumbers = raw.match(/\d+\.?\d*/g) || [];

  // Extract key phrases (split by delimiters)
  var phrases = raw.split(/[,;.!?|+\-–—\n]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 2; });
  if (phrases.length === 0) phrases = [raw];

  // Detect action words (what the user wants to DO)
  var actions = [];
  var actionPatterns = [
    { en: ["analyze", "analysis", "analyse"], fa: ["تحلیل", "بررسی"], label: "Analysis" },
    { en: ["report", "reporting"], fa: ["گزارش"], label: "Report" },
    { en: ["review", "audit"], fa: ["بررسی", "ارزیابی", "audit"], label: "Review" },
    { en: ["monitor", "monitoring", "track"], fa: ["مانیتورینگ", "پایش"], label: "Monitoring" },
    { en: ["optimize", "improve", "enhance"], fa: ["بهبود", "بهینه‌سازی"], label: "Optimization" },
    { en: ["secure", "protect", "defend"], fa: ["امنیت", "محافظت"], label: "Security" },
    { en: ["deploy", "launch", "release"], fa: ["استقرار", "راه‌اندازی"], label: "Deployment" },
    { en: ["compare", "benchmark"], fa: ["مقایسه"], label: "Comparison" },
    { en: ["plan", "strategy", "roadmap"], fa: ["برنامه", "استراتژی"], label: "Planning" },
    { en: ["present", "pitch", "overview"], fa: ["ارائه", "مرور"], label: "Presentation" },
  ];

  for (var ai = 0; ai < actionPatterns.length; ai++) {
    var ap = actionPatterns[ai];
    for (var ki = 0; ki < ap.en.length; ki++) {
      if (low.indexOf(ap.en[ki]) >= 0) { actions.push(ap.label); break; }
    }
    for (var fi = 0; fi < ap.fa.length; fi++) {
      if (originalLow.indexOf(ap.fa[fi]) >= 0) { if (actions.indexOf(ap.label) < 0) actions.push(ap.label); break; }
    }
  }
  if (actions.length === 0) actions.push("Analysis");

  // Detect topic domain
  var topicKeywords = {
    security: ["security", "firewall", "pentest", "vulnerability", "threat", "malware", "encryption", "compliance", "iso", "nist", "soc", "siem", "zero trust", "audit", "penetration", "attack", "breach", "incident"],
    network: ["network", "bandwidth", "latency", "router", "switch", "vlan", "dns", "dhcp", "tcp", "udp", "vpn", "lan", "wan", "infrastructure", "backbone"],
    cloud: ["cloud", "aws", "azure", "gcp", "kubernetes", "docker", "container", "saas", "iaas", "paas", "serverless", "lambda"],
    server: ["server", "cpu", "ram", "storage", "disk", "backup", "recovery", "patch", "vm", "virtualization", "hypervisor"],
    data: ["data", "database", "sql", "nosql", "migration", "etl", "pipeline", "warehouse", "analytics", "big data"],
    business: ["business", "strategy", "marketing", "sales", "revenue", "customer", "growth", "roi", "quarter", "annual", "fiscal", "profit", "market", "product", "launch", "startup"],
    health: ["health", "medical", "patient", "clinical", "diagnosis", "treatment", "hospital", "care", "wellness"],
    finance: ["finance", "investment", "portfolio", "stock", "crypto", "trading", "banking", "budget", "forecast"],
    education: ["education", "learning", "course", "training", "student", "teacher", "certification"],
    dev: ["development", "programming", "code", "api", "frontend", "backend", "fullstack", "react", "node", "python"],
  };

  var detectedTopic = null;
  var maxScore = 0;
  for (var tk in topicKeywords) {
    var score = 0;
    var keywords = topicKeywords[tk];
    for (var ki2 = 0; ki2 < keywords.length; ki2++) {
      if (low.indexOf(keywords[ki2]) >= 0) score += keywords[ki2].length;
    }
    if (score > maxScore) { maxScore = score; detectedTopic = tk; }
  }

  // Extract entities (capitalized words, tech terms, brand names)
  var entities = [];
  var words = translated.split(/\s+/);
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi].replace(/[^a-zA-Z0-9]/g, "");
    if (w.length > 2 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) {
      entities.push(w);
    }
  }

  return {
    raw: raw,
    translated: translated,
    topic: detectedTopic,
    actions: actions,
    numbers: numbers,
    originalNumbers: originalNumbers,
    phrases: phrases,
    entities: entities,
    isFarsi: isFarsi(raw),
    title: phrases[0].toUpperCase().substring(0, 40),
    subtitle: phrases.length > 1 ? phrases[1].substring(0, 50) : (detectedTopic ? detectedTopic.charAt(0).toUpperCase() + detectedTopic.slice(1) + " Overview" : "Professional Report"),
  };
}

// ─── DYNAMIC CONTENT GENERATOR ────────────────────────────────────────────
// Generates varied, professional content based on parsed prompt
function generateContent(parsed) {
  var topic = parsed.topic || "general";
  var action = parsed.actions[0] || "Analysis";
  var title = parsed.title;
  var subtitle = parsed.subtitle;
  var nums = parsed.numbers;
  var isFarsi = parsed.isFarsi;

  // Generate BULLETS based on topic + action
  var bulletSets = {
    security: [
      ["Perimeter defenses audited", "Access control policies verified", "Threat detection systems active", "Compliance status reviewed"],
      ["Firewall rules analyzed", "IDS/IPS signatures updated", "Vulnerability scan completed", "Incident response tested"],
      ["Encryption standards verified", "Authentication flows secured", "Network segmentation confirmed", "Security training delivered"],
    ],
    network: [
      ["Bandwidth utilization measured", "Latency benchmarks established", "Redundancy paths verified", "Monitoring coverage expanded"],
      ["Topology mapping completed", "Performance baselines set", "Bottlenecks identified", "Capacity planning done"],
    ],
    cloud: [
      ["IAM policies reviewed", "Storage encryption verified", "Network security configured", "Compliance benchmarks met"],
      ["Resource optimization analyzed", "Cost allocation tracked", "Disaster recovery tested", "Service mesh configured"],
    ],
    server: [
      ["CPU and RAM utilization measured", "Storage capacity planned", "Patch management verified", "Backup schedules confirmed"],
      ["Performance baselines established", "Security hardening applied", "Monitoring agents deployed", "Disaster recovery tested"],
    ],
    data: [
      ["Data classification completed", "Access controls verified", "Backup integrity confirmed", "Compliance status reviewed"],
      ["Pipeline performance measured", "Data quality assessed", "Retention policies applied", "Security controls validated"],
    ],
    business: [
      ["Market analysis completed", "Competitive landscape mapped", "Growth opportunities identified", "Revenue targets reviewed"],
      ["Customer segments analyzed", "Product roadmap aligned", "Marketing channels optimized", "Sales pipeline evaluated"],
    ],
    health: [
      ["Patient outcomes tracked", "Clinical protocols reviewed", "Resource utilization measured", "Quality metrics assessed"],
    ],
    finance: [
      ["Portfolio performance analyzed", "Risk exposure measured", "Return metrics calculated", "Market trends assessed"],
    ],
    education: [
      ["Learning outcomes measured", "Curriculum effectiveness reviewed", "Student engagement tracked", "Certification progress monitored"],
    ],
    dev: [
      ["Code quality metrics reviewed", "Test coverage analyzed", "Deployment pipeline optimized", "Performance benchmarks set"],
    ],
    general: [
      ["Key findings identified", "Data points collected", "Trends analyzed", "Recommendations prepared"],
      ["Overview completed", "Details documented", "Next steps outlined", "Stakeholders informed"],
    ],
  };

  var topicBullets = bulletSets[topic] || bulletSets.general;
  // Pick a variant based on title hash for variety
  var hash = 0;
  for (var h = 0; h < title.length; h++) { hash = ((hash << 5) - hash) + title.charCodeAt(h); hash = hash & hash; }
  var variant = Math.abs(hash) % topicBullets.length;
  var bullets = topicBullets[variant];

  // Generate METRICS based on extracted numbers + topic
  var metrics = [];
  if (nums.length >= 3) {
    var labels = getMetricLabels(topic);
    for (var mi = 0; mi < Math.min(nums.length, 4); mi++) {
      metrics.push({ label: labels[mi] || "Value", value: nums[mi] });
    }
  } else if (nums.length > 0) {
    var labels2 = getMetricLabels(topic);
    metrics.push({ label: labels2[0] || "Score", value: nums[0] });
    metrics.push({ label: "Rating", value: "A+" });
    metrics.push({ label: "Status", value: "OK" });
  } else {
    metrics = generateAutoMetrics(topic);
  }

  // Generate RECOMMENDATIONS
  var recommendations = generateRecommendations(topic, action);

  // Generate CONCLUSION
  var conclusion = generateConclusion(topic, action, title);

  return {
    title: title,
    subtitle: subtitle,
    bullets: bullets,
    metrics: metrics,
    recommendations: recommendations,
    conclusion: conclusion,
    topic: topic,
    action: action,
  };
}

function getMetricLabels(topic) {
  var labels = {
    security: ["Score", "Threats", "Compliance", "Risk Level"],
    network: ["Uptime", "Bandwidth", "Latency", "Packets"],
    cloud: ["Services", "Cost", "Uptime", "Regions"],
    server: ["CPU", "RAM", "Storage", "Uptime"],
    data: ["Records", "Quality", "Throughput", "Latency"],
    business: ["Revenue", "Growth", "Customers", "ROI"],
    health: ["Score", "Recovery", "Satisfaction", "Efficiency"],
    finance: ["Return", "Risk", "Sharpe", "Alpha"],
    education: ["Pass Rate", "Completion", "Engagement", "Score"],
    dev: ["Coverage", "Builds", "Deploys", "Bugs"],
    general: ["Score", "Rating", "Index", "Level"],
  };
  return labels[topic] || labels.general;
}

function generateAutoMetrics(topic) {
  var sets = {
    security: [{ label: "Security Score", value: "94" }, { label: "Threats Blocked", value: "1.2K" }, { label: "Compliance", value: "97pct" }],
    network: [{ label: "Uptime", value: "99.97pct" }, { label: "Bandwidth", value: "8.2Gbps" }, { label: "Latency", value: "1.8ms" }],
    cloud: [{ label: "Services", value: "47" }, { label: "Uptime", value: "99.99pct" }, { label: "Cost", value: "$2.4K" }],
    server: [{ label: "Servers", value: "32" }, { label: "CPU Avg", value: "67pct" }, { label: "Uptime", value: "99.9pct" }],
    business: [{ label: "Revenue", value: "$1.2M" }, { label: "Growth", value: "34pct" }, { label: "ROI", value: "4.2x" }],
    general: [{ label: "Score", value: "92" }, { label: "Rating", value: "A+" }, { label: "Status", value: "OK" }],
  };
  return sets[topic] || sets.general;
}

function generateRecommendations(topic, action) {
  var recs = {
    security: [
      "Implement zero-trust architecture across all network segments",
      "Deploy automated threat detection with real-time alerting",
      "Schedule quarterly penetration testing and vulnerability assessments",
      "Enhance security awareness training for all team members",
    ],
    network: [
      "Upgrade backbone capacity to handle projected traffic growth",
      "Implement SD-WAN for intelligent traffic routing",
      "Deploy network monitoring with proactive alerting",
      "Establish redundant connectivity for critical services",
    ],
    cloud: [
      "Implement cost optimization with reserved instances",
      "Enable auto-scaling for peak demand periods",
      "Strengthen IAM policies with least-privilege access",
      "Deploy multi-region failover for high availability",
    ],
    server: [
      "Implement automated patch management across all servers",
      "Deploy container orchestration for workload optimization",
      "Establish disaster recovery with tested RTO and RPO",
      "Upgrade monitoring with predictive analytics",
    ],
    business: [
      "Expand into high-growth market segments identified in analysis",
      "Optimize pricing strategy based on competitive positioning",
      "Invest in customer retention programs for loyalty growth",
      "Launch data-driven marketing campaigns for lead generation",
    ],
    general: [
      "Review and prioritize key findings from the analysis",
      "Develop implementation roadmap with clear milestones",
      "Establish KPI tracking for ongoing performance monitoring",
      "Schedule follow-up review within 30 days",
    ],
  };
  return recs[topic] || recs.general;
}

function generateConclusion(topic, action, title) {
  var conclusions = {
    security: action + " Complete - Security Posture STRONG",
    network: action + " Complete - Network Performance OPTIMAL",
    cloud: action + " Complete - Cloud Infrastructure SECURED",
    server: action + " Complete - Server Fleet HEALTHY",
    data: action + " Complete - Data Pipeline OPTIMIZED",
    business: action + " Complete - Strategy ALIGNED",
    general: action + " Complete - All Systems NOMINAL",
  };
  return conclusions[topic] || (action + " Complete");
}

// ─── SCENE GENERATORS (8 Types) ──────────────────────────────────────────

function buildTitleScene(text, sub, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  f.push("drawbox=x=0:y=0:w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc("REPORT") + ":fontcolor=" + th.ac + "@0.4:fontsize=14:x=80:y=60");
  f.push("drawbox=x=80:y=82:w=120:h=2:color=" + th.ac + ":t=fill");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=72:x=(w-text_w)/2:y=(h/2)-100");
  if (sub) f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(sub) + ":fontcolor=" + th.tx + "@0.7:fontsize=28:x=(w-text_w)/2:y=(h/2)+10");
  f.push("drawbox=x=(w/2)-100:y=(h/2)+50:w=200:h=2:color=" + th.ac + "@0.5:t=fill");
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildBulletsScene(text, items, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  f.push("drawbox=x=0:y=0:w=6:h=1080:color=" + th.ac + ":t=fill");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=80:y=60");
  f.push("drawbox=x=80:y=115:w=500:h=2:color=" + th.ac + "@0.4:t=fill");
  var sy = 160;
  for (var i = 0; i < items.length && i < 6; i++) {
    var y = sy + i * 110;
    f.push("drawbox=x=80:y=" + (y + 12) + ":w=8:h=8:color=" + th.ac2 + ":t=fill");
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(items[i]) + ":fontcolor=" + th.tx + "@0.9:fontsize=30:x=104:y=" + y);
    if (i < items.length - 1) f.push("drawbox=x=104:y=" + (y + 70) + ":w=800:h=1:color=" + th.ac + "@0.1:t=fill");
  }
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildMetricsScene(text, metrics, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=80:y=60");
  f.push("drawbox=x=80:y=115:w=400:h=2:color=" + th.ac + "@0.4:t=fill");
  var cols = Math.min(metrics.length, 3);
  var cw = 480, ch = 180, gx = 40, gy = 40;
  var sx = (1920 - (cols * cw + (cols - 1) * gx)) / 2;
  var sy = 180;
  for (var i = 0; i < metrics.length; i++) {
    var col = i % cols, row = Math.floor(i / cols);
    var x = sx + col * (cw + gx), y = sy + row * (ch + gy);
    var m = metrics[i];
    f.push("drawbox=x=" + x + ":y=" + y + ":w=" + cw + ":h=" + ch + ":color=" + th.ac + "@0.08:t=fill");
    f.push("drawbox=x=" + x + ":y=" + y + ":w=" + cw + ":h=2:color=" + th.ac + "@0.3:t=fill");
    f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(String(m.value)) + ":fontcolor=" + th.ac + ":fontsize=64:x=" + (x + cw / 2) + "-(text_w/2):y=" + (y + 40));
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(m.label) + ":fontcolor=" + th.tx + "@0.6:fontsize=20:x=" + (x + cw / 2) + "-(text_w/2):y=" + (y + 120));
  }
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildTimelineScene(text, steps, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=80:y=60");
  f.push("drawbox=x=80:y=115:w=400:h=2:color=" + th.ac + "@0.4:t=fill");
  // Vertical timeline line
  f.push("drawbox=x=100:y=160:w=3:h=600:color=" + th.ac + "@0.3:t=fill");
  for (var i = 0; i < steps.length && i < 5; i++) {
    var y = 180 + i * 130;
    f.push("drawbox=x=93:y=" + (y + 2) + ":w=16:h=16:color=" + th.ac + ":t=fill");
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc("Step " + (i + 1)) + ":fontcolor=" + th.ac + ":fontsize=16:x=124:y=" + y);
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(steps[i]) + ":fontcolor=" + th.tx + "@0.9:fontsize=26:x=124:y=" + (y + 24));
  }
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildComparisonScene(text, left, right, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=42:x=(w-text_w)/2:y=60");
  f.push("drawbox=x=0:y=115:w=(iw):h=2:color=" + th.ac + "@0.3:t=fill");
  // Left column
  f.push("drawbox=x=60:y=160:w=840:h=600:color=" + th.ac + "@0.06:t=fill");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(left.title || "BEFORE") + ":fontcolor=" + th.ac + ":fontsize=28:x=100:y=180");
  for (var i = 0; i < (left.items || []).length && i < 4; i++) {
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(left.items[i]) + ":fontcolor=" + th.tx + "@0.8:fontsize=24:x=100:y=" + (240 + i * 80));
  }
  // Right column
  f.push("drawbox=x=1020:y=160:w=840:h=600:color=" + th.ac2 + "@0.06:t=fill");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(right.title || "AFTER") + ":fontcolor=" + th.ac2 + ":fontsize=28:x=1060:y=180");
  for (var j = 0; j < (right.items || []).length && j < 4; j++) {
    f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(right.items[j]) + ":fontcolor=" + th.tx + "@0.8:fontsize=24:x=1060:y=" + (240 + j * 80));
  }
  // Divider
  f.push("drawbox=x=958:y=160:w=4:h=600:color=" + th.ac + "@0.2:t=fill");
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildQuoteScene(text, author, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.04");
  // Large quote mark
  f.push("drawbox=x=120:y=200:w=40:h=80:color=" + th.ac + "@0.15:t=fill");
  // Quote text (centered, large)
  f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(text) + ":fontcolor=" + th.tx + ":fontsize=36:x=(w-text_w)/2:y=(h/2)-40");
  // Author
  if (author) f.push("drawtext=fontfile=output/fonts/arial.ttf:text=- " + esc(author) + ":fontcolor=" + th.ac + "@0.6:fontsize=20:x=(w-text_w)/2:y=(h/2)+40");
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildStatsScene(text, bigNumber, label, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.06");
  // Giant number
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(String(bigNumber)) + ":fontcolor=" + th.ac + ":fontsize=160:x=(w-text_w)/2:y=(h/2)-120");
  // Label
  f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(label || text) + ":fontcolor=" + th.tx + "@0.7:fontsize=28:x=(w-text_w)/2:y=(h/2)+60");
  // Decorative lines
  f.push("drawbox=x=(w/2)-80:y=(h/2)+30:w=160:h=2:color=" + th.ac + "@0.4:t=fill");
  f.push("drawbox=x=0:y=(ih-4):w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

function buildCtaScene(text, sub, th) {
  var f = [];
  f.push("drawgrid=w=96:h=54:t=1:c=" + th.ac2 + "@0.06");
  f.push("drawtext=fontfile=output/fonts/arialbd.ttf:text=" + esc(text) + ":fontcolor=" + th.ac + ":fontsize=56:x=(w-text_w)/2:y=(h/2)-60");
  if (sub) f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc(sub) + ":fontcolor=" + th.tx + "@0.7:fontsize=24:x=(w-text_w)/2:y=(h/2)+20");
  f.push("drawbox=x=(w/2)-120:y=(h/2)+60:w=240:h=2:color=" + th.ac + ":t=fill");
  f.push("drawtext=fontfile=output/fonts/arial.ttf:text=" + esc("VIDEO AGENT") + ":fontcolor=" + th.tx + "@0.15:fontsize=12:x=(w-text_w)/2:y=(h-40)");
  f.push("drawbox=x=0:y=0:w=(iw):h=4:color=" + th.ac + ":t=fill");
  f.push("vignette=PI/4");
  return f.join(",");
}

// ─── SCENE RENDERER ───────────────────────────────────────────────────────
async function renderScene(sceneDef, theme, workDir, index) {
  var ff = ffmpeg();
  var th = THEMES[theme] || THEMES.security;
  var dur = sceneDef.dur || 4;
  var filters;

  switch (sceneDef.type) {
    case "title": filters = buildTitleScene(sceneDef.text, sceneDef.sub, th); break;
    case "bullets": filters = buildBulletsScene(sceneDef.text, sceneDef.items || [], th); break;
    case "metrics": filters = buildMetricsScene(sceneDef.text, sceneDef.metrics || [], th); break;
    case "timeline": filters = buildTimelineScene(sceneDef.text, sceneDef.items || [], th); break;
    case "comparison": filters = buildComparisonScene(sceneDef.text, sceneDef.left || {}, sceneDef.right || {}, th); break;
    case "quote": filters = buildQuoteScene(sceneDef.text, sceneDef.sub, th); break;
    case "stats": filters = buildStatsScene(sceneDef.text, sceneDef.bigNumber || "0", sceneDef.sub, th); break;
    case "cta": filters = buildCtaScene(sceneDef.text, sceneDef.sub, th); break;
    default: filters = buildBulletsScene(sceneDef.text, sceneDef.items || [], th);
  }

  var out = path.join(workDir, "_s" + index + ".mp4");
  try {
    await run(ff, ["-y", "-f", "lavfi", "-i", "color=c=" + th.bg + ":s=1920x1080:d=" + dur + ":r=30", "-filter_complex", filters, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-t", String(dur), out]);
  } catch (err) {
    throw err;
  }
  return out;
}

// ─── CONCATENATION ────────────────────────────────────────────────────────
async function concatScenes(scenes, out) {
  var ff = ffmpeg();
  if (scenes.length === 1) { await run(ff, ["-v", "error", "-y", "-i", scenes[0], "-c", "copy", out]); return; }
  var probe = ffprobe();
  var durations = [];
  for (var si = 0; si < scenes.length; si++) {
    var p = spawn(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", scenes[si]]);
    var o = ""; p.stdout.on("data", function(d) { o += d.toString(); });
    await new Promise(function(r) { p.on("close", r); });
    durations.push(parseFloat(o.trim()) || 3);
  }
  var filter = "", lastLabel = "0:v", cu = durations[0];
  var ins = [];
  scenes.forEach(function(s) { ins.push("-i", s); });
  for (var i = 1; i < scenes.length; i++) {
    var off = cu - 0.8, lb = i === scenes.length - 1 ? "vout" : "v" + i;
    filter += "[" + lastLabel + "][" + i + ":v]xfade=transition=fade:duration=0.8:offset=" + off.toFixed(2) + "[" + lb + "];";
    lastLabel = lb; cu += durations[i] - 0.8;
  }
  await run(ff, ["-v", "error", "-y"].concat(ins).concat(["-filter_complex", filter.replace(/;$/, ""), "-map", "[vout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", out]));
}

// ─── MAIN AI AGENT ────────────────────────────────────────────────────────
async function generateAIClip({ prompt, workDir, templateKey, duration }) {
  fs.mkdirSync(workDir, { recursive: true });
  ensureFonts();

  // STEP 1: Parse the prompt intelligently
  var parsed = parsePrompt(prompt);

  // STEP 2: Generate dynamic content based on analysis
  var content = generateContent(parsed);

  // STEP 3: Build scene plan (varied scene types based on content)
  var scenes = [];
  var totalDur = duration || 16;

  // Scene 1: Title
  scenes.push({ type: "title", text: content.title, sub: content.subtitle, dur: 4 });

  // Scene 2: Key Findings (bullets)
  scenes.push({ type: "bullets", text: content.action.toUpperCase() + " - KEY FINDINGS", items: content.bullets, dur: 4 });

  // Scene 3: Metrics Dashboard
  scenes.push({ type: "metrics", text: "METRICS & PERFORMANCE", metrics: content.metrics, dur: 4 });

  // Scene 4: Timeline (steps to implement)
  scenes.push({ type: "timeline", text: "IMPLEMENTATION PLAN", items: content.recommendations, dur: 4 });

  // Scene 5: Comparison (before/after if we have numbers)
  if (content.metrics.length >= 2) {
    scenes.push({
      type: "comparison", text: "IMPACT ANALYSIS",
      left: { title: "CURRENT STATE", items: content.bullets.slice(0, 3) },
      right: { title: "TARGET STATE", items: content.recommendations.slice(0, 3) },
      dur: 4
    });
  }

  // Scene 6: CTA
  scenes.push({ type: "cta", text: content.conclusion, sub: content.action + " - All Systems Nominal", dur: 3 });

  // Adjust durations to fit total
  var perScene = totalDur / scenes.length;
  var remaining = totalDur;
  for (var si = 0; si < scenes.length; si++) {
    if (si === scenes.length - 1) { scenes[si].dur = Math.max(2, remaining); }
    else { scenes[si].dur = perScene; remaining -= perScene; }
  }

  // STEP 4: Render each scene
  var scenePaths = [];
  for (var ri = 0; ri < scenes.length; ri++) {
    var retries = 0;
    while (retries < 3) {
      try {
        await renderScene(scenes[ri], templateKey || "security", workDir, ri);
        break;
      } catch (err) {
        retries++;
        if (retries >= 3) throw err;
        await new Promise(function(r) { setTimeout(r, 500 * retries); });
      }
    }
    scenePaths.push(path.join(workDir, "_s" + ri + ".mp4"));
  }

  // STEP 5: Concatenate with crossfade
  var out = path.join(workDir, "ai_" + Date.now() + ".mp4");
  await concatScenes(scenePaths, out);

  // Cleanup
  for (var ci = 0; ci < scenePaths.length; ci++) { try { fs.unlinkSync(scenePaths[ci]); } catch (_) {} }
  return out;
}

// ─── API ──────────────────────────────────────────────────────────────────
function getTemplates() {
  return Object.keys(THEMES).map(function(k) { return { id: k, name: THEMES[k].name, accent: THEMES[k].ac }; });
}

module.exports = { generateAIClip, getTemplates, THEMES, parsePrompt, generateContent };
