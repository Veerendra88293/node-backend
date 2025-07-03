const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/automate', async (req, res) => {
  const websiteDetails = req.body;
  const dpidObjs = websiteDetails.dpidValues;
  let results = new Array(dpidObjs.length); // Pre-fill results array
  let browser;
  try {
    // Launch Puppeteer without proxy support
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    const concurrency = 3;
    async function processOne(dpidObj, idx) {
      const dpid = typeof dpidObj === 'object' ? dpidObj.dpid : dpidObj;
      const name = typeof dpidObj === 'object' && dpidObj.name ? dpidObj.name : '';
      const idType = typeof dpidObj === 'object' && dpidObj.idType ? dpidObj.idType : 'DPID';
      let page;
      let dialogMessage = null;
      let result = '';
      try {
        page = await browser.newPage();
        // Dismiss any dialogs/alerts automatically and capture the message
        page.on('dialog', async dialog => {
          console.log('Dialog detected:', dialog.message());
          dialogMessage = dialog.message();
          await dialog.dismiss();
        });
        console.log('Navigating to URL:', websiteDetails.url, 'for DPID:', dpid);
        await page.goto(websiteDetails.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        console.log('Page loaded for DPID:', dpid);

        // Select the company by visible text (case-insensitive, trimmed)
        console.log('Selecting company:', websiteDetails.company);
        await page.evaluate((companyName) => {
          const select = document.getElementById('ddlCompany');
          const options = Array.from(select.options);
          // Match ignoring case, extra spaces, and HTML line breaks
          const normalize = str => str.replace(/\s+/g, ' ').replace(/\n/g, '').trim().toLowerCase();
          const target = normalize(companyName);
          const match = options.find(opt => normalize(opt.textContent) === target);
          if (match) {
            select.value = match.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, websiteDetails.company);
        console.log('Company selected for DPID:', dpid);
        // Wait for any dependent UI to update (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Select the correct radio button and input field based on idType
        if (idType === 'PAN') {
          console.log('Selecting PAN radio button for PAN:', dpid);
          // Click the PAN radio button by value or id
          await page.click('input[type="radio"][value="PAN"]');
          // Wait for the PAN input to appear (id="txtStat")
          console.log('Waiting for PAN input field for PAN:', dpid);
          await page.waitForSelector('#txtStat', { visible: true, timeout: 10000 });
          console.log('PAN input field visible for PAN:', dpid);
          // Enter the PAN (clear and type)
          await page.evaluate(() => {
            const panInput = document.getElementById('txtStat');
            if (panInput) panInput.value = '';
          });
          await page.type('#txtStat', dpid);
          console.log('PAN entered for PAN:', dpid);
        } else {
          // Default to DPID
          console.log('Selecting DP/Client ID radio button for DPID:', dpid);
          await page.click('input[type="radio"][value="other"]');
          // Wait for the DP/Client ID input to appear (update selector if needed)
          console.log('Waiting for DP/Client ID input field for DPID:', dpid);
          await page.waitForSelector('input.input-text_new[placeholder*="DP"]', { visible: true, timeout: 10000 });
          console.log('DP/Client ID input field visible for DPID:', dpid);
          // Enter the DP ID
          await page.evaluate(() => {
            document.querySelector('input.input-text_new[placeholder*="DP"]').value = '';
          });
          await page.type('input.input-text_new[placeholder*="DP"]', dpid);
          console.log('DP ID entered for DPID:', dpid);
        }

        // Set up dialog handler BEFORE clicking submit
        let dialogPromise = new Promise(resolve => {
          page.once('dialog', async dialog => {
            console.log('Dialog detected:', dialog.message());
            await dialog.dismiss();
            resolve({ type: 'dialog', message: dialog.message() });
          });
        });

        // Click the Submit button
        console.log('Clicking Submit button for DPID:', dpid);
        await page.click('#btnsearc');

        // Wait for either a dialog or the result table (whichever comes first)
        let tablePromise = (async () => {
          try {
            console.log('Waiting for result table for DPID:', dpid);
            await page.waitForSelector('#tbl_DetSec', { visible: true, timeout: 1000 }); // 1 second
            const tableText = await page.$eval('#tbl_DetSec', el => el.innerText);
            return { type: 'table', message: tableText };
          } catch (err) {
            // If table not found, check for error message on page
            console.log('Result table not found for DPID:', dpid, 'checking for error message...');
            const errorMsg = await page.evaluate(() => {
              const errEl = document.querySelector('.error, .error-message, .validation-summary-errors, .text-danger');
              return errEl ? errEl.innerText : null;
            });
            if (errorMsg) {
              return { type: 'error', message: 'Error on page: ' + errorMsg };
            } else {
              return { type: 'error', message: `Not applied or not found with name: ${name}` };
            }
          }
        })();

        const winner = await Promise.race([dialogPromise, tablePromise]);
        if (winner.type === 'dialog') {
          result = 'Error: ' + winner.message;
        } else {
          result = winner.message;
        }
        results[idx] = { dpid, name, result }; // Store at correct index
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        results[idx] = { dpid, name, result: 'Error: ' + err.message };
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        if (page) {
          try { await page.close(); } catch (e) { }
        }
      }
    }
    async function runParallel() {
      let running = [];
      let next = 0;
      function launchOne(i) {
        const p = processOne(dpidObjs[i], i);
        p.finally(() => {
          running = running.filter(pr => pr !== p);
        });
        running.push(p);
      }
      while (next < dpidObjs.length || running.length > 0) {
        while (running.length < concurrency && next < dpidObjs.length) {
          launchOne(next);
          next++;
        }
        if (running.length > 0) {
          await Promise.race(running);
        }
      }
    }
    await runParallel();
    await browser.close();
    console.log('All jobs completed for this /automate request.');
    res.json({ success: true, results });
  } catch (err) {
    if (browser) await browser.close();
    res.json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
