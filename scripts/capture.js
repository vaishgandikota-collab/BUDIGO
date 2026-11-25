const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const browserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function capture(url, outPath, width = 1200, height = 900) {
  const fullOut = path.resolve(outPath);
  console.log(`Capturing ${url} to ${fullOut} at ${width}x${height}...`);
  try {
    execSync(`"${browserPath}" --headless --disable-gpu --virtual-time-budget=6000 --window-size=${width},${height} --screenshot="${fullOut}" "${url}"`, {
      stdio: 'inherit',
      timeout: 25000,
    });
    if (fs.existsSync(fullOut)) {
      console.log(`Success! File size: ${fs.statSync(fullOut).size} bytes`);
    } else {
      console.log(`File was not created.`);
    }
  } catch (e) {
    console.error(`Error:`, e.message);
  }
}

const targetUrl = process.argv[2] || 'http://localhost:8081/room';
const targetFile = process.argv[3] || 'screenshot.png';
const width = parseInt(process.argv[4] || '1200', 10);
const height = parseInt(process.argv[5] || '900', 10);

capture(targetUrl, targetFile, width, height);
