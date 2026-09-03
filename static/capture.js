const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');
const resultEl = document.getElementById('result');

let currentLat = null;
let currentLng = null;
let isScanning = false;
let scanInterval = null;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
    statusEl.textContent = "Camera ready. Waiting for GPS…";
  } catch (err) {
    statusEl.textContent = "Camera access denied or unavailable: " + err.message;
  }
}

function startLocation() {
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported by this browser.";
    return;
  }
  navigator.geolocation.watchPosition(
    (pos) => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      if (!isScanning) startScanning();
    },
    (err) => {
      statusEl.textContent = "Location error: " + err.message;
    },
    { enableHighAccuracy: true }
  );
}

function startScanning() {
  isScanning = true;
  captureBtn.style.display = "none";
  statusEl.textContent = "🟢 No damage detected. Scanning…";
  scanInterval = setInterval(captureAndAnalyze, 3000);
}

async function captureAndAnalyze() {
  if (currentLat === null || currentLng === null) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');

    const url = `http://127.0.0.1:8000/detect?latitude=${currentLat}&longitude=${currentLng}`;

    try {
      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();

      if (data.detections && data.detections.length > 0) {
        showResult(data.detections);
        statusEl.textContent = "⚠️ Damage found! Pausing 8s before next scan…";

        clearInterval(scanInterval);
        setTimeout(() => {
          statusEl.textContent = "🟢 No damage detected. Scanning…";
          scanInterval = setInterval(captureAndAnalyze, 3000);
        }, 8000);
      } else {
        statusEl.textContent = "🟢 No damage detected. Scanning…";
      }
    } catch (err) {
      statusEl.textContent = "Connection error: " + err.message;
    }
  }, 'image/jpeg', 0.85);
}

function showResult(detections) {
  const card = detections.map(d => `
    <div class="result-card ${d.severity}">
      <div class="type">${d.damage_type}</div>
      <div class="meta">Confidence: ${(d.confidence * 100).toFixed(0)}% · Severity: ${d.severity}</div>
    </div>
  `).join('');
  resultEl.innerHTML = card + resultEl.innerHTML;
}

startCamera();
startLocation();