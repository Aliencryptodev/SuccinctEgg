window.currentEggColor = window.currentEggColor || eggColors[0];

function renderEggColorButtons() {
  const container = document.getElementById('eggColorButtons');
  if (!container) return;
  container.innerHTML = '';
  eggColors.forEach(color => {
    const btn = document.createElement('button');
    btn.title = color.label;
    btn.type = 'button';
    btn.className = 'egg-color-btn' + (window.currentEggColor.name === color.name ? ' selected' : '');
    btn.onclick = () => { selectEggColor(color.name); };
    const img = document.createElement('img');
    img.src = color.icon;
    img.alt = color.label + ' egg';
    btn.appendChild(img);
    container.appendChild(btn);
  });
}

function selectEggColor(colorName) {
  const color = eggColors.find(c => c.name === colorName);
  if (color) {
    window.currentEggColor = color;
    updateEggBaseImages();
    renderEggColorButtons();
    if (typeof redrawEditCanvas === "function") redrawEditCanvas();
    if (typeof renderPreview === "function") renderPreview();
  }
}

function updateEggBaseImages() {
  window.editorBaseImg = window.currentEggColor.eggImg;      // Color plano (1000x1000)
  window.previewBandejaImg = window.currentEggColor.previewImg; // Bandeja (800x560)
}

window.addEventListener('DOMContentLoaded', () => {
  renderEggColorButtons();
  updateEggBaseImages();
});