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

async function run() {
  const port = 9334;
  const tmpProfile = path.join(process.env.TEMP || 'C:\\temp', 'cdp_prof_' + Date.now());

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
    await send('Runtime.enable');

    // 1. Desktop Viewport (1280x900)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('Navigating to http://localhost:8081/discover ...');
    await send('Page.navigate', { url: 'http://localhost:8081/discover' });

    // Wait for Expo bundle to load
    await new Promise((r) => setTimeout(r, 6000));

    // Hide any Expo dev banners
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('div').forEach(el => {
            if (el.textContent && (el.textContent.includes('Refreshing...') || el.textContent.includes('Downloading...'))) {
              el.style.display = 'none';
            }
          });
        })()
      `,
    });

    // Capture Initial Screen
    const initShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_initial_desktop.png', Buffer.from(initShot.data, 'base64'));
    console.log('Captured discover_initial_desktop.png');

    // 2. Click "⚡ Find Fair Meeting Areas" button
    console.log('Clicking "⚡ Find Fair Meeting Areas" button...');
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const elements = Array.from(document.querySelectorAll('div, span, button'));
          const btn = elements.find(el => el.textContent && el.textContent.includes('Find Fair Meeting Areas'));
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('Click result:', clickRes.result.value);

    // Wait for Google Places + Routes API calculation and Leaflet route rendering
    console.log('Waiting 12s for API calculations and Leaflet map rendering...');
    await new Promise((r) => setTimeout(r, 12000));

    // Hide Expo banners again
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          document.querySelectorAll('div').forEach(el => {
            if (el.textContent && (el.textContent.includes('Refreshing...') || el.textContent.includes('Downloading...'))) {
              el.style.display = 'none';
            }
          });
        })()
      `,
    });

    // Capture calculated areas & venues desktop screenshot
    const areaShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_fair_results_desktop.png', Buffer.from(areaShot.data, 'base64'));
    console.log('Captured discover_fair_results_desktop.png');

    // 3. Mobile Viewport (390x844)
    console.log('Switching to mobile viewport (390x844)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });

    await new Promise((r) => setTimeout(r, 1500));
    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_fair_results_mobile.png', Buffer.from(mobileShot.data, 'base64'));
    console.log('Captured discover_fair_results_mobile.png');

    // 4. Scroll down to capture breakdown & action buttons
    await send('Runtime.evaluate', {
      expression: `window.scrollBy(0, 750);`,
    });
    await new Promise((r) => setTimeout(r, 1000));
    const mobileScrolled = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_breakdown_mobile.png', Buffer.from(mobileScrolled.data, 'base64'));
    console.log('Captured discover_breakdown_mobile.png');

    ws.close();
  } catch (err) {
    console.error('Error during test flow:', err);
  } finally {
    chrome.kill();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
}

run();
