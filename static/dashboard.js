const API_URL = "http://127.0.0.1:8000/reports";

const severityColor = {
  Severe: "#E4572E",
  Moderate: "#F2A93B",
  Minor: "#8FB05B"
};

const map = L.map('map', { zoomControl: true }).setView([27.7, 85.3], 3);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

const markers = {};

async function loadReports() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const listEl = document.getElementById('list');
    const statsEl = document.getElementById('stats');

    if (!data.length) {
      listEl.innerHTML = '<div id="empty">No reports yet.</div>';
      statsEl.textContent = '0 reports';
      return;
    }

    statsEl.textContent = `${data.length} reports`;
    listEl.innerHTML = '';

    data.forEach(report => {
      const color = severityColor[report.severity] || '#999';

      const imageHtml = report.image_url
        ? `<img src="${report.image_url}" style="width:220px;max-width:100%;border-radius:6px;margin-top:8px;display:block;">`
        : '';

      const marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 1,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindPopup(`
        <b>${report.damage_type}</b><br>
        ${report.severity} · ${(report.confidence * 100).toFixed(0)}%
        ${imageHtml}
      `);
      markers[report.id] = marker;

      const row = document.createElement('div');
      row.className = 'report-row';
      row.innerHTML = `
        <span class="badge ${report.severity}">${report.severity}</span>
        <span class="type">${report.damage_type}</span>
        <div class="meta">
          Confidence: ${(report.confidence * 100).toFixed(0)}% · ${new Date(report.created_at).toLocaleString()}
        </div>
      `;
      row.addEventListener('click', () => {
        map.flyTo([report.latitude, report.longitude], 14);
        marker.openPopup();
      });

      listEl.appendChild(row);
    });
  } catch (err) {
    document.getElementById('list').innerHTML =
      `<div id="empty">Couldn't load reports.<br>Is your FastAPI server running?<br><br>${err}</div>`;
  }
}

loadReports();