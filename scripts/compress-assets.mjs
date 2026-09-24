/**
 * scripts/compress-assets.mjs
 * Compress FinTrack asset images to optimal sizes for EAS build.
 *
 * Auto-detects actual format (JPEG or PNG) regardless of file extension.
 * Only writes the result if it is smaller than the original.
 *
 * Requires: sharp (installed as devDependency)
 * Usage:    node scripts/compress-assets.mjs
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');

const require = createRequire(import.meta.url);
const sharp = require('sharp');

function formatKB(bytes) {
  return Math.round(bytes / 1024) + ' KB';
}

const targets = [
  { file: 'icon.png',          width: 1024, height: 1024, jpegQ: 75, pngLevel: 9 },
  { file: 'adaptive-icon.png', width: 1024, height: 1024, jpegQ: 75, pngLevel: 9 },
  { file: 'splash-icon.png',   width: 1024, height: 1024, jpegQ: 75, pngLevel: 9 },
  { file: 'favicon.png',       width: 64,   height: 64,   jpegQ: 70, pngLevel: 9 },
];

console.log('\n🗜  Compressing FinTrack assets...\n');

for (const target of targets) {
  const filePath = path.join(assetsDir, target.file);
  const backupPath = filePath + '.backup';
  const tmpPath = filePath + '.tmp';

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${target.file} — not found, skipping`);
    continue;
  }

  const originalSize = fs.statSync(filePath).size;

  // Detect actual format
  const meta = await sharp(filePath).metadata();
  const actualFormat = meta.format; // 'jpeg' | 'png' | 'webp' etc.

  let outputBuf;
  if (actualFormat === 'jpeg') {
    // Keep JPEG — re-encode with mozjpeg optimiser at target quality
    outputBuf = await sharp(filePath)
      .resize(target.width, target.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: target.jpegQ, mozjpeg: true })
      .toBuffer();
  } else {
    // PNG — use maximum zlib compression
    outputBuf = await sharp(filePath)
      .resize(target.width, target.height, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: target.pngLevel, adaptiveFiltering: true })
      .toBuffer();
  }

  if (outputBuf.length >= originalSize) {
    console.log(`  ⏭️  ${target.file.padEnd(22)} ${formatKB(originalSize).padStart(7)} — already optimal (format: ${actualFormat})`);
    continue;
  }

  // Back up original (once)
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  // Write to tmp then rename — avoids file-lock issues
  fs.writeFileSync(tmpPath, outputBuf);
  fs.renameSync(tmpPath, filePath);

  const saving = originalSize - outputBuf.length;
  const pct = ((saving / originalSize) * 100).toFixed(1);
  console.log(`  ✅  ${target.file.padEnd(22)} ${formatKB(originalSize).padStart(7)} → ${formatKB(outputBuf.length).padStart(7)}   saved ${formatKB(saving)} (${pct}%) [${actualFormat}]`);
}

console.log('\n✅  Done! Originals backed up as *.backup');
console.log('   To restore: copy *.backup files back to *.png\n');

