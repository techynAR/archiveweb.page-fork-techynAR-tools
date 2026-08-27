const puppeteer = require('puppeteer');
const path = require('path');

const extensionPath = path.resolve(__dirname, 'dist'); // assuming the built extension is here
console.log('Extension path:', extensionPath);

(async () => {
  const browser = await puppeteer.launch({
    headless: "new", // Headless new supports extensions in some versions, or use false
    // But extensions only work in headful mode generally:
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--no-sandbox`
    ]
  });

  console.log("Launched browser...");

  // Find the background service worker
  const targets = await browser.targets();
  const backgroundTarget = targets.find(t => t.type() === 'service_worker' || t.type() === 'background_page');
  
  if (!backgroundTarget) {
    console.error("Could not find background service worker!");
  } else {
    const backgroundWorker = await backgroundTarget.worker();
    backgroundWorker.on('console', msg => {
      if (msg.text().includes('PIPELINE')) {
        console.log(`[BG] ${msg.text()}`);
      }
    });
    console.log("Attached to background worker logs.");
  }

  // Open the test page
  const page = await browser.newPage();
  await page.goto('http://localhost:8765/test_no_reload.html');
  console.log("Navigated to test page.");
  
  // Wait a moment for things to settle
  await new Promise(r => setTimeout(r, 2000));

  // Trigger recording (we can do this by sending a message to the extension)
  // But how do we trigger it from Puppeteer?
  // We can open the popup and click the record button.
  // The popup URL is chrome-extension://<id>/popup.html
  // Let's find the extension ID
  let extensionId = '';
  const serviceWorkerTarget = targets.find(t => t.type() === 'service_worker');
  if (serviceWorkerTarget) {
    const url = serviceWorkerTarget.url(); // chrome-extension://<id>/sw.js
    extensionId = url.split('/')[2];
  }

  if (extensionId) {
    console.log("Extension ID:", extensionId);
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    console.log("Opened popup page.");
    
    // We would need to click "Start" etc... but there's no UI for no-reload yet.
    // Instead, let's just evaluate a script in the background page to trigger it directly!
  }
  
  if (backgroundTarget) {
    const backgroundWorker = await backgroundTarget.worker();
    await backgroundWorker.evaluate(async () => {
      // Send a message to start recording in no-reload mode
      // Let's find the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        chrome.runtime.sendMessage({
          type: "start",
          tabId: tabs[0].id,
          options: {
            collId: "test-collection",
            noReload: true,
            autoStop: false
          }
        });
      });
    });
    console.log("Sent start recording message to background.");
  }

  await new Promise(r => setTimeout(r, 5000));

  if (backgroundTarget) {
    const backgroundWorker = await backgroundTarget.worker();
    await backgroundWorker.evaluate(async () => {
      chrome.runtime.sendMessage({ type: "stop" });
    });
    console.log("Sent stop recording message to background.");
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  console.log("Done.");
})();
