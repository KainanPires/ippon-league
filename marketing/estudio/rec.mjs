import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const meta = JSON.parse(fs.readFileSync('meta.json', 'utf8'));
const only = process.argv.slice(2); const FPS = 30;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [k, dur] of Object.entries(meta)) {
  if (only.length && !only.includes(k)) continue;
  await p.goto('file://' + process.cwd() + '/' + k + '.html'); await p.waitForTimeout(500);
  fs.rmSync('fr', { recursive: true, force: true }); fs.mkdirSync('fr');
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) { await p.evaluate((t) => window.render(t), i / FPS);
    await p.screenshot({ path: `fr/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 }); }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', 'fr/%05d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', `out/${k}.mp4`]);
  console.log(k, n, 'frames');
}
await b.close();
