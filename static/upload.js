const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const coordsEl = document.getElementById('coords');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const submitBtn = document.getElementById('submitBtn');
const resultEl = document.getElementById('result');

let selectedLat = null;
let selectedLng = null;
let selectedFile = null;
let marker = null;

// Map setup, defaulting to a broad world view
const map = L.map('map').setView([27.7, 85.3], 5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// Try to center on the user's current location if available
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((pos) => {
    map.setView([pos.coords.latitude, pos.coords.longitude], 14);
  });
}

map.on('click', (e) => {
  selectedLat = e.latlng.lat;
  selectedLng = e.latlng.lng;

  if (marker) map.removeLayer(marker);
  marker = L.marker([selectedLat, selectedLng]).addTo(map);

  coordsEl.textContent = `Selected: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
  step2.style.display = 'block';
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length === 0) return;
  selectedFile = fileInput.files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(selectedFile);

  submitBtn.disabled = false;
});

document.getElementById('uploadLabel').addEventListener('click', () => {
  fileInput.click();
});

submitBtn.addEventListener('click', async () => {
  if (!selectedFile || selectedLat === null) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  const formData = new FormData();
  formData.append('file', selectedFile);

  const url = `http://127.0.0.1:8000/detect?latitude=${selectedLat}&longitude=${selectedLng}`;

  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json();
    showResult(data.detections);
  } catch (err) {
    resultEl.innerHTML = `<div class="result-card">Error: ${err.message}</div>`;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Check Severity";
});

function showResult(detections) {
  if (!detections || detections.length === 0) {
    resultEl.innerHTML = `<div class="result-card">No damage detected in this photo.</div>`;
    return;
  }

  resultEl.innerHTML = detections.map(d => `
    <div class="result-card ${d.severity}">
      <div class="type">${d.damage_type}</div>
      <div class="meta">Confidence: ${(d.confidence * 100).toFixed(0)}% · Severity: ${d.severity}</div>
    </div>
  `).join('');
}