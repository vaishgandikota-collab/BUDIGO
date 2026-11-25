const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require(path.resolve('./mobile/node_modules/ws'));

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function captureWithCDP(url, outPath, width = 390, height = 844) {
  const port = 9333;
  const tmpProfile = path.join(process.env.TEMP || 'C:\\temp', 'cdp_prof_' + Date.now());
  const fullOut = path.resolve(outPath);

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpProfile}`,
    'about:blank',
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === msgId) {
            ws.off('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 860,
    });

    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url });

    // Wait 12 seconds for full Google Places API + Routes calculation and render
    await new Promise((r) => setTimeout(r, 12000));

    // Hide any Expo dev banners
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('div').forEach(el => {
            if (el.textContent && el.textContent.includes('Refreshing...')) {
              el.style.display = 'none';
            }
          });
        })()
      `,
    });

    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(fullOut, Buffer.from(data, 'base64'));
    console.log(`Successfully captured ${width}x${height} screenshot to ${fullOut} (${fs.statSync(fullOut).size} bytes)`);

    ws.close();
  } catch (e) {
    console.error('CDP capture failed:', e.message);
  } finally {
    chrome.kill();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
}

const targetUrl = process.argv[2] || 'http://localhost:8081/room';
const targetFile = process.argv[3] || 'cdp_shot.png';
const width = parseInt(process.argv[4] || '1200', 10);
const height = parseInt(process.argv[5] || '900', 10);

captureWithCDP(targetUrl, targetFile, width, height);
