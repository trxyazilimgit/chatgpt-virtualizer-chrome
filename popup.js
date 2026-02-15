const toggle = document.getElementById('toggle');
const bufferSlider = document.getElementById('buffer');
const bufferVal = document.getElementById('bufval');
const vcountEl = document.getElementById('vcount');
const tcountEl = document.getElementById('tcount');
const ringEl = document.getElementById('ring');
const pctEl = document.getElementById('pct');

const CIRCUMFERENCE = 2 * Math.PI * 18; // r=18

function updateStats(virtualized, total) {
  vcountEl.textContent = virtualized;
  tcountEl.textContent = total;

  const ratio = total > 0 ? virtualized / total : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);
  ringEl.style.strokeDashoffset = offset;
  pctEl.textContent = Math.round(ratio * 100) + '%';
}

// Load saved state
chrome.storage.local.get(['enabled', 'bufferSize', 'stats'], (result) => {
  toggle.checked = result.enabled !== undefined ? result.enabled : true;
  const buf = result.bufferSize !== undefined ? result.bufferSize : 2000;
  bufferSlider.value = buf;
  bufferVal.textContent = buf + 'px';

  if (result.stats) {
    updateStats(result.stats.virtualized || 0, result.stats.total || 0);
  }
});

// Toggle
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

// Buffer slider
bufferSlider.addEventListener('input', () => {
  bufferVal.textContent = bufferSlider.value + 'px';
});

bufferSlider.addEventListener('change', () => {
  chrome.storage.local.set({ bufferSize: parseInt(bufferSlider.value, 10) });
});

// Poll stats while popup is open
const statsInterval = setInterval(() => {
  chrome.storage.local.get(['stats'], (result) => {
    if (result.stats) {
      updateStats(result.stats.virtualized || 0, result.stats.total || 0);
    }
  });
}, 1000);

window.addEventListener('unload', () => clearInterval(statsInterval));
