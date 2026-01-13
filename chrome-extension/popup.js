const API_BASE = 'https://drivetime-kappa.vercel.app';

let currentTab = null;
let selectedType = 'article';

// Get current tab info
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0];
  document.getElementById('pageUrl').textContent = currentTab.url;
  document.getElementById('titleInput').placeholder = currentTab.title || 'Add a note (optional)';
});

// Type selection
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
  });
});

// Save button
document.getElementById('saveBtn').addEventListener('click', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const noteInput = document.getElementById('titleInput');
  
  if (!currentTab?.url) {
    statusEl.textContent = 'Could not get page URL';
    statusEl.className = 'status error';
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span>Saving...';
  statusEl.textContent = '';
  statusEl.className = 'status';
  
  try {
    const note = noteInput.value.trim();
    const content = note || currentTab.title || currentTab.url;
    
    const response = await fetch(`${API_BASE}/api/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: selectedType,
        content: content,
        sourceUrl: currentTab.url
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    statusEl.textContent = '✓ Saved to DriveTime!';
    statusEl.className = 'status success';
    saveBtn.textContent = 'Saved!';
    
    // Close popup after brief delay
    setTimeout(() => window.close(), 1500);
    
  } catch (error) {
    console.error('Save error:', error);
    statusEl.textContent = 'Failed to save. Try again.';
    statusEl.className = 'status error';
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to DriveTime';
  }
});

// Allow Enter key to save
document.getElementById('titleInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveBtn').click();
  }
});
