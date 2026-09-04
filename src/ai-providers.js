// AI Clip Generator - multi-scene content from prompts. No special chars in text.
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const P = path.join(__dirname, "..");

function ensureFonts() {
  const fd = path.join(P, "output", "fonts");
  if (!fs.existsSync(fd)) {
    fs.mkdirSync(fd, { recursive: true });
    try {
      const f = { "arial.ttf": "C:/Windows/Fonts/arial.ttf", "arialbd.ttf": "C:/Windows/Fonts/arialbd.ttf" };
      for (const [d, s] of Object.entries(f)) { if (fs.existsSync(s)) fs.copyFileSync(s, path.join(fd, d)); }
    } catch (_) {}
  }
}
function ffmpeg() { const l = path.join(P, "ffmpeg", "bin", "ffmpeg.exe"); return fs.existsSync(l) ? l : "ffmpeg"; }
function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: P });
    let e = ""; p.stderr.on("data", d => { if (e.length < 8192) e += d.toString(); });
    p.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg " + c + "\n" + e.slice(-1500))));
  });
}

const T = {
  security: { bg: "0x0a0e17", ac: "0x00e5ff", ac2: "0x39ff88", tx: "0xe8f6ff" },
  corporate: { bg: "0x0f172a", ac: "0x3b82f6", ac2: "0x10b981", tx: "0xf1f5f9" },
  tech: { bg: "0x050510", ac: "0x8b5cf6", ac2: "0x06b6d4", tx: "0xe2e8f0" },
  minimal: { bg: "0x18181b", ac: "0xfafafa", ac2: "0xa1a1aa", tx: "0xfafafa" },
  bold: { bg: "0x1a0000", ac: "0xff3860", ac2: "0xff9f43", tx: "0xfff1f2" },
};

// Content with NO colons and NO commas
const C = {
  firewall: { t: "FIREWALL ANALYSIS", s: "Perimeter Defense", tp: ["Rules - 847 audited - 23 percent redundant", "Zones - 12 configured - 3 gaps", "ACLs - 98 percent compliance", "IPS - 12.4K threats blocked daily"], m: ["99.7 Uptime", "23ms Latency", "12.4K Blocked"], sm: "Firewall rated STRONG" },
  penetration: { t: "PENTEST REPORT", s: "Vulnerability Assessment", tp: ["External - 3 critical - 7 high", "Internal - Priv escalation found", "Web - SQLi - XSS - CSRF found", "Social - 34 percent phishing rate"], m: ["3 Critical", "7 High", "15 Medium"], sm: "Critical vulns patched in 48h" },
  vulnerability: { t: "VULN REPORT", s: "Risk Assessment", tp: ["CVEs - 156 found 23 systems", "Patches - 89 percent compliance", "Hardening - 12 recommendations", "Risk - 8.2 reduced to 3.1"], m: ["156 CVEs", "89 Patched", "Risk 3.1"], sm: "Risk within tolerance" },
  network: { t: "NETWORK INFRA", s: "Performance Analysis", tp: ["Bandwidth - 78 percent peak - 45 percent avg", "Latency - Core under 2ms", "Redundancy - Dual-path links", "Monitoring - 99.9 percent SNMP"], m: ["99.95 Uptime", "78% Peak", "Under 2ms"], sm: "Meets enterprise SLA" },
  server: { t: "SERVER AUDIT", s: "Health Check", tp: ["CPU 62 - RAM 71 - Storage 58%", "Patches - 94 percent across 47 servers", "Backups - RPO 4h - RTO 1h", "Performance - All normal"], m: ["47 Servers", "94 Compliant", "RTO 1h"], sm: "Infrastructure stable" },
  cloud: { t: "CLOUD SECURITY", s: "AWS Azure GCP", tp: ["IAM - 234 users 18 excess perms", "Storage - All encrypted", "Network - 0 trust violations", "CIS - 92 percent benchmark"], m: ["234 Users", "100 Encrypted", "CIS 92%"], sm: "Hardened to standards" },
  data: { t: "DATA PROTECTION", s: "Privacy Review", tp: ["AES-256 rest, TLS 1.3 transit", "RBAC and MFA enforced", "89 percent data properly labeled", "340+ exfil attempts blocked"], m: ["AES-256", "TLS 1.3", "340+ Blocked"], sm: "Meets GDPR requirements" },
  monitoring: { t: "MONITORING", s: "Observability Review", tp: ["2.4M events per day processed", "Alerts - 1200 to 89 actionable", "MTTD - 4hrs to 12 minutes", "98 percent services monitored"], m: ["2.4M Events", "MTTD 12min", "98% Coverage"], sm: "SOC capabilities enhanced" },
  audit: { t: "SECURITY AUDIT", s: "Comprehensive Assessment", tp: ["24 policies - 8 updates needed", "156 accounts - 12 disabled", "Incident response passed", "SOC2 certified - ISO pending"], m: ["24 Policies", "SOC2 Done", "ISO Pending"], sm: "Strong governance" },
  infrastructure: { t: "INFRASTRUCTURE", s: "Architecture Review", tp: ["3 DCs - 47 VMs - 12 containers", "120TB storage - 58 percent utilized", "10Gbps backbone - redundant ISP", "DR tested - RTO under 4h"], m: ["3 DCs", "120TB Storage", "RTO Under 4h"], sm: "Ready for BC" },
};

function detect(prompt) {
  const l = prompt.toLowerCase();
  for (const [k, v] of Object.entries(C)) { if (l.includes(k)) return v; }
  return { t: prompt.toUpperCase().substring(0, 40), s: "Professional Report", tp: [prompt + " - Key findings", "Analysis completed", "Risk assessment done", "Recommendations ready"], m: ["Analysis Done", "Report Ready", "Complete"], sm: prompt + " report done" };
}

async function scene({ text, sub, det, th, dur, idx, total, wd }) {
  const ff = ffmpeg(), d = dur || 3;
  const f = "output/fonts/arial.ttf", b = "output/fonts/arialbd.ttf";
  let v = "drawgrid=w=96:h=54:t=1:c=" + th.ac + "@0.08,";

  if (idx === 0) {
    v += "drawtext=fontfile=" + f + ":text=REPORT:fontcolor=" + th.ac + "@0.5:fontsize=16:x=60:y=50,";
    v += "drawbox=x=60:y=80:w=200:h=2:color=" + th.ac + ":t=fill,";
    v += "drawtext=fontfile=" + b + ":text=" + text + ":fontcolor=" + th.ac + ":fontsize=80:x=(w-text_w)/2:y=(h/2)-80,";
    if (sub) v += "drawtext=fontfile=" + f + ":text=" + sub + ":fontcolor=" + th.tx + "@0.7:fontsize=32:x=(w-text_w)/2:y=(h/2)+20,";
    v += "drawbox=x=60:y=1020:w=1800:h=1:color=" + th.ac + "@0.2:t=fill,";
  } else if (idx === total - 1) {
    v += "drawtext=fontfile=" + b + ":text=SUMMARY:fontcolor=" + th.ac + ":fontsize=48:x=60:y=60,";
    v += "drawbox=x=60:y=120:w=150:h=2:color=" + th.ac + ":t=fill,";
    v += "drawtext=fontfile=" + b + ":text=" + text + ":fontcolor=" + th.tx + ":fontsize=36:x=60:y=180,";
    if (det) {
      det.split("|").map(s => s.trim()).filter(Boolean).forEach((item, i) => {
        const x = 60 + i * 300;
        v += "drawbox=x=" + x + ":y=280:w=260:h=80:color=" + th.ac + "@0.1:t=fill,";
        v += "drawtext=fontfile=" + b + ":text=" + item + ":fontcolor=" + th.ac + ":fontsize=22:x=" + (x + 130) + ":y=310,";
      });
    }
    v += "drawtext=fontfile=" + f + ":text=VIDEO AGENT:fontcolor=" + th.tx + "@0.2:fontsize=14:x=(w-text_w)/2:y=1030,";
  } else {
    v += "drawbox=x=0:y=0:w=6:h=1080:color=" + th.ac + ":t=fill,";
    v += "drawtext=fontfile=" + b + ":text=" + text + ":fontcolor=" + th.ac + ":fontsize=44:x=60:y=60,";
    v += "drawbox=x=60:y=120:w=600:h=2:color=" + th.ac + "@0.4:t=fill,";
    if (sub) v += "drawtext=fontfile=" + f + ":text=" + sub + ":fontcolor=" + th.tx + "@0.6:fontsize=24:x=60:y=140,";
    if (det) {
      det.split("|").map(p => p.trim()).filter(Boolean).forEach((pt, i) => {
        v += "drawtext=fontfile=" + f + ":text=" + pt + ":fontcolor=" + th.tx + "@0.9:fontsize=28:x=120:y=" + (220 + i * 100) + ",";
      });
    }
  }
  v += "vignette=PI/4";

  const out = path.join(wd, "_s" + idx + ".mp4");
  await run(ff, ["-y", "-f", "lavfi", "-i", "color=c=" + th.bg + ":s=1920x1080:d=" + d + ":r=30", "-filter_complex", v, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-t", String(d), out]);
  return out;
}

async function concat(scenes, out) {
  const ff = ffmpeg();
  if (scenes.length === 1) { await run(ff, ["-v", "error", "-y", "-i", scenes[0], "-c", "copy", out]); return; }
  const fp = path.join(P, "ffmpeg", "bin", "ffprobe.exe");
  const probe = fs.existsSync(fp) ? fp : "ffprobe";
  const ds = [];
  for (const s of scenes) {
    const p = spawn(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", s]);
    let o = ""; p.stdout.on("data", d => o += d.toString());
    await new Promise(r => p.on("close", r));
    ds.push(parseFloat(o.trim()) || 3);
  }
  let fl = "", la = "0:v", cu = ds[0]; const ins = [];
  scenes.forEach(s => ins.push("-i", s));
  for (let i = 1; i < scenes.length; i++) {
    const off = cu - 0.8, lb = i === scenes.length - 1 ? "vout" : "v" + i;
    fl += "[" + la + "][" + i + ":v]xfade=transition=fade:duration=0.8:offset=" + off.toFixed(2) + "[" + lb + "];";
    la = lb; cu += ds[i] - 0.8;
  }
  await run(ff, ["-v", "error", "-y", ...ins, "-filter_complex", fl.replace(/;$/, ""), "-map", "[vout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", out]);
}

async function generateAIClip({ prompt, workDir, templateKey, duration }) {
  fs.mkdirSync(workDir, { recursive: true }); ensureFonts();
  const th = T[templateKey] || T.security;
  const topic = detect(prompt || "Professional Report");
  const td = duration || 12, sd = td / 4;
  const defs = [
    { text: topic.t, sub: topic.s },
    { text: "KEY FINDINGS 1", sub: topic.s, det: topic.tp.slice(0, 2).join("|") },
    { text: "KEY FINDINGS 2", sub: topic.s, det: topic.tp.slice(2).join("|") },
    { text: topic.sm, det: topic.m.join("|") },
  ];
  const ps = [];
  for (let i = 0; i < defs.length; i++) {
    await scene({ ...defs[i], th, dur: sd, idx: i, total: defs.length, wd: workDir });
    ps.push(path.join(workDir, "_s" + i + ".mp4"));
  }
  const out = path.join(workDir, "ai_" + Date.now() + ".mp4");
  await concat(ps, out);
  for (const p of ps) { try { fs.unlinkSync(p); } catch (_) {} }
  return out;
}

function getTemplates() {
  return Object.keys(T).map(k => ({ id: k, name: k[0].toUpperCase() + k.slice(1), accent: T[k].ac, tags: Object.keys(C).slice(0, 5) }));
}

module.exports = { generateAIClip, getTemplates, THEMES: T };
