function storeCompanyName() {
    const companyName = document.getElementById('companyName').value;
    const dpids = JSON.parse(localStorage.getItem('dpids')) || [];
    const dpidValues = dpids.map(item => item.dpid);
    const websiteDetails = {
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        company: companyName,
        radioButtonValue: 'DP/Client ID',
        dpidInputFieldName: 'DPID',
        dpidValues: dpidValues, // Store all DPIDs as an array
        submitButtonText: 'Submit'
    };
      localStorage.setItem('websiteDetails', JSON.stringify(websiteDetails));
      alert('Company name stored successfully!');
    }


let dpids = JSON.parse(localStorage.getItem('dpids')) || [];
document.getElementById('add-dpid-btn').addEventListener('click', addDpid);

function addDpid() {
    const nameInput = document.getElementById('name');
    const dpidInput = document.getElementById('dpid');
    const idTypeInput = document.getElementById('idType');
    const name = nameInput.value.trim();
    const dpid = dpidInput.value.trim();
    const idType = idTypeInput.value;

    if (name === '' || dpid === '') {
        alert('Name and ID cannot be null');
        return;
    }

    // Validation
    if (idType === 'DPID' && (dpid.length !== 16 || !/^\d{16}$/.test(dpid))) {
        alert('Invalid DPID. It must be exactly 16 digits Number.');
        return;
    }
    if (idType === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(dpid)) {
        alert('Invalid PAN. It must be 10 characters (e.g., ABCDE1234F).');
        return;
    }

    dpids.push({ name, dpid, idType });
    localStorage.setItem('dpids', JSON.stringify(dpids));
    alert('Added successfully');
    nameInput.value = '';
    dpidInput.value = '';
    displayDpids();
}

// Add this function to display all user entries in the user-list section
function displayUserEntries() {
    const userEntriesDiv = document.getElementById('user-entries');
    const dpids = JSON.parse(localStorage.getItem('dpids')) || [];
    if (dpids.length === 0) {
        userEntriesDiv.innerHTML = '<span style="color:#888;">No entries added yet.</span>';
        return;
    }
    userEntriesDiv.innerHTML = '<ul style="list-style:none;padding:0;margin:0;">' +
        dpids.map((item, idx) => `
            <li class="user-entry" data-idx="${idx}">
                <span><b>${(item.name || '').toUpperCase()}</b>: ${(item.dpid || '').toUpperCase()} <span style=\"color:#888;font-size:0.97em;\">(${(item.idType ? item.idType.toUpperCase() : 'DP/ID')})</span></span>
                <button class="edit-entry-btn" data-idx="${idx}" style="margin-right:6px;">Edit</button>
                <button class="delete-entry-btn" data-idx="${idx}">Delete</button>
            </li>`).join('') +
        '</ul>';
    // Add event listeners for delete
    Array.from(document.getElementsByClassName('delete-entry-btn')).forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(this.getAttribute('data-idx'), 10);
            dpids.splice(idx, 1);
            localStorage.setItem('dpids', JSON.stringify(dpids));
            displayUserEntries();
        };
    });
    // Add event listeners for edit
    Array.from(document.getElementsByClassName('edit-entry-btn')).forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(this.getAttribute('data-idx'), 10);
            const entry = dpids[idx];
            const newName = prompt('Edit Name:', entry.name);
            if (newName === null) return;
            const newDpid = prompt('Edit DP ID or PAN:', entry.dpid);
            if (newDpid === null) return;
            const newIdType = prompt('Edit Type (DPID or PAN):', entry.idType);
            if (newIdType === null) return;
            dpids[idx] = { name: newName, dpid: newDpid, idType: newIdType };
            localStorage.setItem('dpids', JSON.stringify(dpids));
            displayUserEntries();
        };
    });
}

let runCount = parseInt(localStorage.getItem('runCount') || '0', 10);
let sessionRunCount = 0;

async function automateAndShowResult() {
    // Always get the latest company name and DPIDs from the input/localStorage
    const companyName = document.getElementById('companyName').value;
    const dpids = JSON.parse(localStorage.getItem('dpids')) || [];
    if (!companyName) {
        alert('Please enter the company name.');
        return;
    }
    if (dpids.length === 0) {
        alert('No DPIDs available.');
        return;
    }
    // Show initial loading message with batch info
    document.getElementById('result').innerHTML = `<div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:12px 0;flex-wrap:wrap;">
      <span class=\"loader\" style=\"width:22px;height:22px;border:3px solid #1976d2;border-top:3px solid #fff;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;\"></span>
      <span style=\"font-size:1.1em;color:#1976d2;\">Checked: <span id='checked-count'>0</span> / ${dpids.length}</span>
      <span style=\"font-size:0.98em;color:#555;margin-left:12px;\">(Processing in batches of 5. Please wait for each batch to complete...)</span>
    </div>`;
    // Add spinner animation CSS if not present
    if (!document.getElementById('loader-style')) {
      const style = document.createElement('style');
      style.id = 'loader-style';
      style.innerHTML = `@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}`;
      document.head.appendChild(style);
    }
    // Split into batches of 5 for per-batch feedback
    const batchSize = 3;
    let allResults = new Array(dpids.length); // Pre-allocate array for correct order
    let greenCount = 0, redCount = 0, blackCount = 0;
    let checkedCount = 0;
    function processResult(resultObj, idx) {
        let allotted = null;
        let error = false;
        let notApplied = false;
        let notAllotted = false;
        let raw = (resultObj.result || '').toLowerCase();
        const match = resultObj.result.match(/Securities Allotted\s*:?[\s\n]*(\d+)/i);
        if (match) {
            allotted = parseInt(match[1], 10);
        } else if (/not applied|application not found|no record found|no data found|invalid|not found/i.test(raw)) {
            notApplied = true;
        } else if (/not allotted|allotted: 0|securities allotted\s*:?[\s\n]*0/i.test(raw)) {
            notAllotted = true;
            allotted = 0;
        } else if (/error|failed|unable to/i.test(raw)) {
            error = true;
        }
        let color = allotted > 0 ? 'green' : allotted === 0 ? 'red' : error || notApplied ? 'black' : 'black';
        if (color === 'green') greenCount++;
        else if (color === 'red') redCount++;
        else blackCount++;
        let allottedText = '';
        if (allotted !== null && allotted > 0) {
            allottedText = `<span style=\"color:green;font-weight:bold\">Securities Allotted: ${allotted}</span>`;
        } else if (allotted === 0 || notAllotted) {
            allottedText = `<span style=\"color:red;font-weight:bold\">Not Allotted</span>`;
        } else if (notApplied) {
            allottedText = `<span style=\"color:black;font-weight:bold\">Not Applied / No Record</span>`;
        } else if (error) {
            allottedText = `<span style=\"color:black;font-weight:bold\">Error</span>`;
        } else {
            allottedText = `<span style=\"color:black;font-weight:bold\">Unknown Result</span>`;
        }
        allResults[idx] = {
            name: resultObj.name,
            allottedText: allottedText
        };
        checkedCount++;
        document.getElementById('checked-count').textContent = checkedCount;
    }
    // Process in batches of 3, each batch in parallel
    let promises = [];
    for (let i = 0; i < dpids.length; i += batchSize) {
        const batch = dpids.slice(i, i + batchSize);
        const batchIndices = Array.from({length: batch.length}, (_, k) => i + k);
        promises.push(
            ...batch.map(async (entry, idx) => {
                const websiteDetails = {
                    url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
                    company: companyName,
                    radioButtonValue: 'DP/Client ID',
                    dpidInputFieldName: 'DPID',
                    dpidValues: [entry], // Single entry as array
                    submitButtonText: 'Submit'
                };
                try {
                    const response = await fetch('http://3.91.100.44:3001/automate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(websiteDetails)
                    });
                    const data = await response.json();
                    let resultObj = data.success && data.results && data.results[0] ? data.results[0] : { name: entry.name, result: 'Error: ' + (data.error || 'Unknown error') };
                    processResult(resultObj, batchIndices[idx]);
                } catch (err) {
                    let resultObj = { name: entry.name, result: 'Error: ' + err.message };
                    processResult(resultObj, batchIndices[idx]);
                }
            })
        );
    }
    await Promise.all(promises);
    // Remove loading indicator before showing summary
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) loadingDiv.remove();
    // Show all results summary after all are done
    let html = '';
    for (let j = 0; j < allResults.length; j++) {
        if (allResults[j]) {
            html += '<div style="margin:18px 0 10px 0;padding:10px 0;border-bottom:1.5px solid #e0e0e0;">' +
                `<b>Name:</b> ${(allResults[j].name || '').toUpperCase()}<br>${allResults[j].allottedText}` +
                '</div>';
        }
    }
    document.getElementById('result').innerHTML =
        html +
        '<hr style="border:2px solid #ccc">' +
        `<div style="margin-top:10px;font-size:1.1em;text-align:center;">` +
        `<span style="color:green;font-weight:bold">Allotted: ${greenCount}</span> | ` +
        `<span style="color:red;font-weight:bold">Not Allotted: ${redCount}</span> | ` +
        `<span style="color:black;font-weight:bold">Not Applied/Other: ${blackCount}</span> | ` +
        `<span style="color:#1976d2;font-weight:bold">Total: ${allResults.length}</span>` +
        `</div>`;
}

// Add this function to populate the company dropdown
function populateCompanyDropdown() {
    const companies = [
        "Kalpataru Limited – IPO",
        "Crizac Limited - IPO",
        "Oswal Pumps Limited - IPO",
        "HDB Financial Services Limited - IPO"
    ];
    const companySelect = document.createElement('select');
    companySelect.id = 'companyName';
    companySelect.innerHTML = companies.map(c => `<option value="${c}">${c}</option>`).join('');
    const oldInput = document.getElementById('companyName');
    oldInput.parentNode.replaceChild(companySelect, oldInput);
}

// --- LOGIN LOGIC FOR USER ENTRIES (RESET & SIMPLIFIED) ---
const USER_EMAIL = 'root@gmail.com';
const USER_PASSWORD = '12345678';

function showUserEntriesLogin() {
    document.getElementById('user-login-form').style.display = '';
    document.getElementById('user-entries').style.display = 'none';
    document.getElementById('user-login-email').value = '';
    document.getElementById('user-login-password').value = '';
    document.getElementById('user-login-error').textContent = '';
    document.getElementById('user-login-btn').onclick = function() {
        const email = document.getElementById('user-login-email').value.trim();
        const pass = document.getElementById('user-login-password').value;
        if (email === USER_EMAIL && pass === USER_PASSWORD) {
            document.getElementById('user-login-form').style.display = 'none';
            document.getElementById('user-entries').style.display = '';
            displayUserEntries();
        } else {
            document.getElementById('user-login-error').textContent = 'Invalid email or password.';
        }
    };
}

document.getElementById('user-list-link').onclick = function(e) {
    e.preventDefault();
    document.getElementById('user-list-link').classList.add('active');
    document.getElementById('home-link').classList.remove('active');
    document.getElementById('home-section').style.display = 'none';
    document.getElementById('user-list-section').style.display = '';
    showUserEntriesLogin();
};

document.getElementById('home-link').onclick = function(e) {
    e.preventDefault();
    document.getElementById('home-link').classList.add('active');
    document.getElementById('user-list-link').classList.remove('active');
    document.getElementById('home-section').style.display = '';
    document.getElementById('user-list-section').style.display = 'none';
};

window.onload = function() {
    populateCompanyDropdown();
    displayUserEntries();
};
