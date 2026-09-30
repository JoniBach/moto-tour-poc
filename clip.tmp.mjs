import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'], userDataDir: process.env.OUT + '/profile3' });
const p = await b.newPage();
p.on('console', (m) => m.type() !== 'log' && console.log(m.type(), m.text().slice(0, 200)));
await p.setViewport({ width: 1400, height: 850, deviceScaleFactor: 2 });
await p.goto(process.env.URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 12000));
if (process.env.ZOOM) { await p.mouse.move(700, 425); for (let i = 0; i < +process.env.ZOOM; i++) { await p.mouse.wheel({ deltaY: -300 }); await new Promise((r) => setTimeout(r, 120)); } await new Promise((r) => setTimeout(r, 2500)); }
await p.screenshot({ path: process.env.OUT + '/' + process.env.NAME + '.png', clip: JSON.parse(process.env.CLIP) });
await b.close();
