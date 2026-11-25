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
  const port = 9335;
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

    // Hide Expo banners
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

    // 1. Click exact CTA button
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('div, button'));
          const btn = all.reverse().find(el => el.textContent && el.textContent.trim() === '⚡ Find Fair Meeting Areas');
          if (btn) {
            btn.click();
            return { success: true, text: btn.textContent.trim() };
          }
          return { success: false, count: all.length };
        })()
      `,
      returnByValue: true,
    });
    console.log('Click CTA result:', clickRes.result.value);

    // Wait for Google API calculation & response (10 seconds)
    console.log('Waiting 10s for API calculations...');
    await new Promise((r) => setTimeout(r, 10000));

    // Check if Tier 1 or Tier 2 elements appeared
    const stateCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          return {
            hasTier1: text.includes('Top Destination Areas'),
            hasTier2: text.includes('Meeting Venues in'),
            hasBreakdown: text.includes('Road Route Breakdown'),
            bodySnippet: text.substring(0, 300)
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('State check:', stateCheck.result.value);

    // Capture Scrolled View 1: Top Destination Areas
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const scrollables = Array.from(document.querySelectorAll('div')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.overflowY === 'auto' || style.overflowY === 'scroll';
          });
          const target = scrollables[0] || window;
          if (target.scrollTop !== undefined) {
            target.scrollTop = 450;
          } else {
            window.scrollTo(0, 450);
          }
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_step3_areas.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved discover_step3_areas.png');

    // Scroll further down to Venues & Breakdown
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const scrollables = Array.from(document.querySelectorAll('div')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.overflowY === 'auto' || style.overflowY === 'scroll';
          });
          const target = scrollables[0] || window;
          if (target.scrollTop !== undefined) {
            target.scrollTop = 1100;
          } else {
            window.scrollTo(0, 1100);
          }
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_step4_venues_breakdown.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved discover_step4_venues_breakdown.png');

    // Mobile viewport (390x844) capture of Venues & Breakdown
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 1500));

    const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('discover_mobile_venues.png', Buffer.from(shotMobile.data, 'base64'));
    console.log('Saved discover_mobile_venues.png');

    ws.close();
  } catch (err) {
    console.error('Error during test flow:', err);
  } finally {
    chrome.kill();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
}

run();
