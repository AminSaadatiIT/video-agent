#!/usr/bin/env node
/**
 * Video Agent — Setup Script
 * Automatically installs dependencies and ffmpeg on Windows
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');

const FFMPEG_DIR = path.join(__dirname, 'ffmpeg');
const FFMPEG_BIN = path.join(FFMPEG_DIR, 'bin', 'ffmpeg.exe');
const FFPROBE_BIN = path.join(FFMPEG_DIR, 'bin', 'ffprobe.exe');

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║     VIDEO AGENT — SETUP WIZARD          ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

function checkFFmpeg() {
  try {
    // Check system ffmpeg first
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'system';
  } catch {}
  // Check local ffmpeg
  if (fs.existsSync(FFMPEG_BIN)) {
    return 'local';
  }
  return null;
}

function checkNode() {
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0]);
  if (major < 18) {
    console.log(`❌ Node.js ${v} detected. Version 18+ required.`);
    console.log('   Download from: https://nodejs.org/');
    process.exit(1);
  }
  console.log(`✅ Node.js ${v} — OK`);
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`   Downloading: ${url}`);
    const file = createWriteStream(dest);
    const request = (downloadUrl) => {
      const proto = downloadUrl.startsWith('https') ? https : require('http');
      proto.get(downloadUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          request(response.headers.location);
          return;
        }
        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalBytes) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r   Progress: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
          }
        });
        response.pipe(file);
        file.on('finish', () => { file.close(); console.log(''); resolve(); });
      }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    };
    request(url);
  });
}

async function installFFmpeg() {
  console.log('');
  console.log('📦 Installing ffmpeg...');
  console.log('   This is a one-time download (~80MB).');
  console.log('');

  const zipPath = path.join(__dirname, 'ffmpeg.zip');
  const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

  try {
    await downloadFile(url, zipPath);
    console.log('   Extracting...');
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${FFMPEG_DIR}_tmp' -Force"`, { stdio: 'pipe' });

    // Find the extracted folder
    const tmpDir = FFMPEG_DIR + '_tmp';
    const extracted = fs.readdirSync(tmpDir).find(d => d.startsWith('ffmpeg-'));
    if (extracted) {
      const binSrc = path.join(tmpDir, extracted, 'bin');
      const binDst = path.join(FFMPEG_DIR, 'bin');
      fs.mkdirSync(binDst, { recursive: true });
      for (const f of fs.readdirSync(binSrc)) {
        fs.copyFileSync(path.join(binSrc, f), path.join(binDst, f));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    fs.unlinkSync(zipPath);
    console.log('✅ ffmpeg installed locally');
    return true;
  } catch (err) {
    console.log('⚠️  Auto-download failed:', err.message);
    console.log('');
    console.log('   Manual install options:');
    console.log('   1. Download from: https://www.gyan.dev/ffmpeg/builds/');
    console.log('   2. Extract and put ffmpeg.exe in ./ffmpeg/bin/');
    console.log('   3. Or install ffmpeg globally and add to PATH');
    return false;
  }
}

async function main() {
  // Step 1: Check Node.js
  console.log('🔍 Step 1: Checking Node.js...');
  checkNode();

  // Step 2: Install npm dependencies
  console.log('');
  console.log('📦 Step 2: Installing dependencies...');
  try {
    execSync('npm install', { cwd: __dirname, stdio: 'pipe' });
    console.log('✅ Dependencies installed');
  } catch (err) {
    console.log('❌ npm install failed:', err.message);
    process.exit(1);
  }

  // Step 3: Check/Install ffmpeg
  console.log('');
  console.log('🔍 Step 3: Checking ffmpeg...');
  const ffmpegStatus = checkFFmpeg();
  if (ffmpegStatus === 'system') {
    console.log('✅ ffmpeg found (system)');
  } else if (ffmpegStatus === 'local') {
    console.log('✅ ffmpeg found (local)');
  } else {
    console.log('❌ ffmpeg not found');
    await installFFmpeg();
  }

  // Step 4: Create .env if not exists
  console.log('');
  console.log('📝 Step 4: Configuration...');
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    const envExample = path.join(__dirname, '.env.example');
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envPath);
      console.log('✅ .env created from .env.example');
    } else {
      fs.writeFileSync(envPath, 'PORT=3000\nAI_VIDEO_API_KEY=\n');
      console.log('✅ .env created');
    }
  } else {
    console.log('✅ .env already exists');
  }

  // Step 5: Ensure directories
  const dirs = ['uploads', 'output'];
  for (const d of dirs) {
    const dirPath = path.join(__dirname, d);
    fs.mkdirSync(dirPath, { recursive: true });
    const gitkeep = path.join(dirPath, '.gitkeep');
    if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, '');
  }
  console.log('✅ Directories ready');

  // Done
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║          ✅ SETUP COMPLETE!              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Run the server:');
  console.log('    npm start');
  console.log('');
  console.log('  Open in browser:');
  console.log('    http://localhost:3000');
  console.log('');
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
