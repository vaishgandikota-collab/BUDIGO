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
  const port = 9337;
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('Navigating to http://localhost:8081/discover ...');
    await send('Page.navigate', { url: 'http://localhost:8081/discover' });
    await new Promise((r) => setTimeout(r, 5000));

    // Hide banners
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

    // Click CTA
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('div, button'));
          const btn = all.reverse().find(el => el.textContent && el.textContent.trim() === '⚡ Find Fair Meeting Areas');
          if (btn) btn.click();
        })()
      `,
    });

    await new Promise((r) => setTimeout(r, 10000));

    // Scroll to the bottom breakdown card
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const scrollables = Array.from(document.querySelectorAll('div')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.overflowY === 'auto' || style.overflowY === 'scroll';
          });
          const target = scrollables[0] || window;
          if (target.scrollTop !== undefined) {
            target.scrollTop = 3200;
          } else {
            window.scrollTo(0, 3200);
          }
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shotBreakdown = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_step5_selected_breakdown.png', Buffer.from(shotBreakdown.data, 'base64'));
    console.log('Saved discover_step5_selected_breakdown.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
}

run();
