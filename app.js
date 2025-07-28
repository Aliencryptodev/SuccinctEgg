// Dimensiones definidas con precisión según el CSS
const editW = 400; // Ancho del canvas de edición (coincide con max-width del CSS)
const editH = 400; // Alto del canvas de edición (coincide con aspect-ratio 1/1)
const previewW = 1600; // Ancho de la vista previa
const previewH = 1120; // Alto de la vista previa
const downloadW = 1000; // Ancho de la imagen descargada
const downloadH = 1000; // Alto de la imagen descargada
const areaNombre = { x: 140, y: 615, w: 420, h: 50 }; // Área para el nombre

// Zona de diseño ajustada al tamaño del canvas (sin márgenes internos)
const ZONA_DISENO = { x: 0, y: 0, w: editW, h: editH }; // Todo el canvas es el área de edición

window.editorBaseImg = window.editorBaseImg || 'assets/eggs/egg_plain.png';
window.previewBandejaImg = window.previewBandejaImg || 'assets/bandejas/bandeja_egg.png';

const editCanvas = document.getElementById('editCanvas');
const editCtx = editCanvas.getContext('2d');
editCanvas.width = editW; // Ajustado a 400px según CSS
editCanvas.height = editH; // Ajustado a 400px según CSS

const brushColor = document.getElementById('brushColor');
const brushSize = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');
const eggName = document.getElementById('eggName');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const eggPreview = document.getElementById('eggPreview');
const eggPreviewCtx = eggPreview.getContext('2d');
eggPreview.width = previewW;
eggPreview.height = previewH;
const fontFamily = document.getElementById('fontFamily');
const fontColor = document.getElementById('fontColor');

const eyesGallery = document.getElementById('eyesGallery');
const mouthGallery = document.getElementById('mouthGallery');
const noseGallery = document.getElementById('noseGallery');
const glassesGallery = document.getElementById('glassesGallery');
const uploadSticker = document.getElementById('uploadSticker');

const eyesStickers = Array.from({ length: 20 }, (_, i) => `assets/stickers/eyes${i + 1}.png`);
const mouthStickers = Array.from({ length: 20 }, (_, i) => `assets/stickers/mouth${i + 1}.png`);
const noseStickers = Array.from({ length: 20 }, (_, i) => `assets/stickers/nose${i + 1}.png`);
const glassesStickers = Array.from({ length: 20 }, (_, i) => `assets/stickers/glasses${i + 1}.png`);

let placedStickers = [];
let drawing = false;
let lastX, lastY;

let selectedStickerIndex = -1;
let dragOffsetX = 0, dragOffsetY = 0;
let resizing = false;
const HANDLE_SIZE = 32;

fontFamily.addEventListener('change', () => { redrawEditCanvas(); renderPreview(); });
fontColor.addEventListener('input', () => { redrawEditCanvas(); renderPreview(); });
eggName.addEventListener('input', () => { redrawEditCanvas(); renderPreview(); });

function loadStickerGallery(categoryArray, container) {
  container.innerHTML = "";
  categoryArray.forEach((src) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = "sticker";
    img.style.width = "40px";
    img.style.height = "40px";
    img.style.margin = "3px";
    img.onclick = () => { addStickerToCanvas(src, false); redrawEditCanvas(); renderPreview(); };
    container.appendChild(img);
  });
}
function loadAllGalleries() {
  loadStickerGallery(eyesStickers, eyesGallery);
  loadStickerGallery(mouthStickers, mouthGallery);
  loadStickerGallery(noseStickers, noseGallery);
  loadStickerGallery(glassesStickers, glassesGallery);
}

uploadSticker.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new window.Image();
    img.onload = () => {
      placedStickers.push({
        img: img,
        x: ZONA_DISENO.x + Math.random() * ZONA_DISENO.w - 180,
        y: ZONA_DISENO.y + Math.random() * ZONA_DISENO.h - 180,
        w: Math.min(180, img.width),
        h: Math.min(180, img.height),
        isUserUpload: true
      });
      selectedStickerIndex = placedStickers.length - 1;
      redrawEditCanvas();
      renderPreview();
    };
    img.onerror = () => {
      console.warn('Sticker image failed to load and was not added.');
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

function fitTextToWidth(ctx, text, fontFamily, baseFontSize, maxWidth, minFontSize = 10) {
  let fontSize = baseFontSize;
  ctx.font = `bold ${fontSize}px "${fontFamily}"`;
  let textWidth = ctx.measureText(text).width;
  while (textWidth > maxWidth && fontSize > minFontSize) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    textWidth = ctx.measureText(text).width;
  }
  return fontSize;
}
function truncateToFit(ctx, text, fontFamily, fontSize, maxWidth) {
  let newText = text;
  ctx.font = `bold ${fontSize}px "${fontFamily}"`;
  while (ctx.measureText(newText).width > maxWidth && newText.length > 0) {
    newText = newText.slice(0, -1);
  }
  if (newText.length < text.length) {
    newText = newText.slice(0, -3) + "...";
  }
  return newText;
}

function getHandleRect(sticker) {
  return { x: sticker.x + sticker.w - HANDLE_SIZE / 2, y: sticker.y + sticker.h - HANDLE_SIZE / 2, w: HANDLE_SIZE, h: HANDLE_SIZE };
}
function getCloseRect(sticker) {
  return { x: sticker.x - HANDLE_SIZE / 2, y: sticker.y - HANDLE_SIZE / 2, w: HANDLE_SIZE, h: HANDLE_SIZE };
}
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function pointInSticker(x, y, sticker) {
  return x >= sticker.x && x <= sticker.x + sticker.w && y >= sticker.y && y <= sticker.y + sticker.h;
}

function redrawEditCanvas() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    editCtx.drawImage(baseImg, 0, 0, editCanvas.width, editCanvas.height);

    editCtx.save();
    editCtx.beginPath();
    editCtx.rect(ZONA_DISENO.x, ZONA_DISENO.y, ZONA_DISENO.w, ZONA_DISENO.h);
    editCtx.clip();

    placedStickers.forEach((st, i) => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        editCtx.drawImage(st.img, st.x, st.y, st.w, st.h);

        if (i === selectedStickerIndex) {
          editCtx.save();
          editCtx.strokeStyle = "#00aaff";
          editCtx.lineWidth = 2.5;
          editCtx.setLineDash([8, 6]);
          editCtx.strokeRect(st.x, st.y, st.w, st.h);
          editCtx.setLineDash([]);

          editCtx.fillStyle = "#fff";
          editCtx.strokeStyle = "#00aaff";
          editCtx.lineWidth = 2;
          editCtx.beginPath();
          editCtx.rect(st.x + st.w - HANDLE_SIZE / 2, st.y + st.h - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          editCtx.fill();
          editCtx.stroke();
          editCtx.drawImage(getResizeIcon(), st.x + st.w - HANDLE_SIZE / 2 + 5, st.y + st.h - HANDLE_SIZE / 2 + 5, 22, 22);

          editCtx.fillStyle = "#fff";
          editCtx.strokeStyle = "#ff4444";
          editCtx.lineWidth = 2;
          editCtx.beginPath();
          editCtx.rect(st.x - HANDLE_SIZE / 2, st.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          editCtx.fill();
          editCtx.stroke();
          editCtx.drawImage(getCloseIcon(), st.x - HANDLE_SIZE / 2 + 5, st.y - HANDLE_SIZE / 2 + 5, 22, 22);

          editCtx.restore();
        }
      }
    });

    editCtx.restore();
  };
  baseImg.onerror = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  };
}

function getResizeIcon() {
  if (!getResizeIcon.img) {
    const svg = `<svg width="22" height="22" viewBox="0 0 22 22"><polyline points="4,18 18,18 18,4" stroke="#00aaff" stroke-width="4" fill="none"/></svg>`;
    const img = new window.Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    getResizeIcon.img = img;
  }
  return getResizeIcon.img;
}
function getCloseIcon() {
  if (!getCloseIcon.img) {
    const svg = `<svg width="22" height="22" viewBox="0 0 22 22"><line x1="4" y1="4" x2="18" y2="18" stroke="#ff4444" stroke-width="4"/><line x1="18" y1="4" x2="4" y2="18" stroke="#ff4444" stroke-width="4"/></svg>`;
    const img = new window.Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    getCloseIcon.img = img;
  }
  return getCloseIcon.img;
}

editCanvas.addEventListener('mousedown', (e) => {
  const [x, y] = getPos(e);
  let found = false;
  for (let i = placedStickers.length - 1; i >= 0; i--) {
    const st = placedStickers[i];
    if (i === selectedStickerIndex) {
      if (pointInRect(x, y, getHandleRect(st))) {
        resizing = true;
        dragOffsetX = x - (st.x + st.w);
        dragOffsetY = y - (st.y + st.h);
        found = true;
        break;
      }
      if (pointInRect(x, y, getCloseRect(st))) {
        placedStickers.splice(i, 1);
        selectedStickerIndex = -1;
        redrawEditCanvas();
        renderPreview();
        found = true;
        break;
      }
    }
    if (pointInSticker(x, y, st) && pointInRect(x, y, ZONA_DISENO)) {
      selectedStickerIndex = i;
      dragOffsetX = x - st.x;
      dragOffsetY = y - st.y;
      resizing = false;
      found = true;
      redrawEditCanvas();
      break;
    }
  }
  if (!found && pointInRect(x, y, ZONA_DISENO)) {
    selectedStickerIndex = -1;
    redrawEditCanvas();
    drawing = true;
    [lastX, lastY] = [x, y];
  }
});

editCanvas.addEventListener('mousemove', (e) => {
  const [x, y] = getPos(e);
  if (resizing && selectedStickerIndex !== -1 && pointInRect(x, y, ZONA_DISENO)) {
    const st = placedStickers[selectedStickerIndex];
    let newW = x - st.x - dragOffsetX;
    let newH = y - st.y - dragOffsetY;
    newW = Math.max(40, Math.min(newW, ZONA_DISENO.x + ZONA_DISENO.w - st.x));
    newH = Math.max(40, Math.min(newH, ZONA_DISENO.y + ZONA_DISENO.h - st.y));
    st.w = newW;
    st.h = newH;
    redrawEditCanvas();
    renderPreview();
    return;
  }
  if (drawing && pointInRect(x, y, ZONA_DISENO)) {
    editCtx.strokeStyle = brushColor.value;
    editCtx.lineWidth = brushSize.value;
    editCtx.lineCap = "round";
    editCtx.lineJoin = "round";
    editCtx.beginPath();
    editCtx.moveTo(lastX, lastY);
    const clippedX = Math.max(ZONA_DISENO.x, Math.min(x, ZONA_DISENO.x + ZONA_DISENO.w));
    const clippedY = Math.max(ZONA_DISENO.y, Math.min(y, ZONA_DISENO.y + ZONA_DISENO.h));
    editCtx.lineTo(clippedX, clippedY);
    editCtx.stroke();
    [lastX, lastY] = [clippedX, clippedY];
    redrawEditCanvas();
    renderPreview();
    return;
  }
  if (selectedStickerIndex !== -1 && (e.buttons & 1) && !resizing && pointInRect(x, y, ZONA_DISENO)) {
    const st = placedStickers[selectedStickerIndex];
    st.x = Math.max(ZONA_DISENO.x, Math.min(x - dragOffsetX, ZONA_DISENO.x + ZONA_DISENO.w - st.w));
    st.y = Math.max(ZONA_DISENO.y, Math.min(y - dragOffsetY, ZONA_DISENO.y + ZONA_DISENO.h - st.h));
    redrawEditCanvas();
    renderPreview();
  }
});

editCanvas.addEventListener('mouseup', () => {
  resizing = false;
  drawing = false;
});
editCanvas.addEventListener('mouseleave', () => {
  resizing = false;
  drawing = false;
});

clearBtn.addEventListener('click', () => {
  editCtx.clearRect(ZONA_DISENO.x, ZONA_DISENO.y, ZONA_DISENO.w, ZONA_DISENO.h);
  placedStickers = [];
  selectedStickerIndex = -1;
  redrawEditCanvas();
  renderPreview();
});

function addStickerToCanvas(src, isUserUpload = false) {
  const img = new window.Image();
  img.onload = () => {
    placedStickers.push({
      img: img,
      x: ZONA_DISENO.x + Math.random() * ZONA_DISENO.w - 180,
      y: ZONA_DISENO.y + Math.random() * ZONA_DISENO.h - 180,
      w: 140,
      h: 140,
      isUserUpload
    });
    selectedStickerIndex = placedStickers.length - 1;
    redrawEditCanvas();
    renderPreview();
  };
  img.onerror = () => {
    console.warn('Sticker image failed to load and was not added.');
  };
  img.src = src;
}

function getPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * editCanvas.width / rect.width,
    (e.clientY - rect.top) * editCanvas.height / rect.height
  ];
}

function renderPreview() {
  const bandejaImg = new window.Image();
  bandejaImg.src = window.previewBandejaImg;
  bandejaImg.onload = () => {
    eggPreviewCtx.clearRect(0, 0, previewW, previewH);
    eggPreviewCtx.drawImage(bandejaImg, 0, 0, previewW, previewH);

    const eggClipArea = { x: 641.2, y: 459.6, w: 329.4, h: 329.4 };

    eggPreviewCtx.save();
    eggPreviewCtx.drawImage(
      editCanvas,
      ZONA_DISENO.x, ZONA_DISENO.y, ZONA_DISENO.w, ZONA_DISENO.h,
      eggClipArea.x, eggClipArea.y, eggClipArea.w, eggClipArea.h
    );
    eggPreviewCtx.restore();

    placedStickers.forEach(st => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        eggPreviewCtx.drawImage(
          st.img,
          st.x * (eggClipArea.w / editW) + eggClipArea.x,
          st.y * (eggClipArea.h / editH) + eggClipArea.y,
          st.w * (eggClipArea.w / editW),
          st.h * (eggClipArea.h / editH)
        );
      }
    });

    if (eggName.value && eggName.value.trim().length > 0) {
      const nameArea = { x: 645.4, y: 890, w: 288.6, h: 56.4 };
      const margin = 10;
      const nameFontSize = fitTextToWidth(eggPreviewCtx, eggName.value, fontFamily.value, nameArea.h - margin, nameArea.w - margin * 2, 12);
      const displayText = truncateToFit(eggPreviewCtx, eggName.value, fontFamily.value, nameFontSize, nameArea.w - margin * 2);
      eggPreviewCtx.save();
      eggPreviewCtx.font = `bold ${nameFontSize}px "${fontFamily.value}"`;
      eggPreviewCtx.fillStyle = fontColor.value || "#000";
      eggPreviewCtx.textAlign = "center";
      eggPreviewCtx.textBaseline = "middle";
      eggPreviewCtx.fillText(displayText, nameArea.x + nameArea.w / 2, nameArea.y + nameArea.h / 2);
      eggPreviewCtx.restore();
    }
  };
}

function renderDownload() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = downloadW;
    downloadCanvas.height = downloadH;
    const downloadCtx = downloadCanvas.getContext('2d');

    const scale = downloadW / editW;
    downloadCtx.drawImage(baseImg, 0, 0, editW, editH, 0, 0, downloadW, downloadH);

    const designScale = downloadW / ZONA_DISENO.w;
    downloadCtx.drawImage(
      editCanvas,
      ZONA_DISENO.x, ZONA_DISENO.y, ZONA_DISENO.w, ZONA_DISENO.h,
      0, 0, downloadW, downloadH
    );

    if (eggName.value && eggName.value.trim().length > 0) {
      const margin = 20;
      const nameFontSize = fitTextToWidth(downloadCtx, eggName.value, fontFamily.value, downloadH * 0.1 - margin, downloadW - margin * 2, 12);
      const displayText = truncateToFit(downloadCtx, eggName.value, fontFamily.value, nameFontSize, downloadW - margin * 2);
      downloadCtx.save();
      downloadCtx.font = `bold ${nameFontSize}px "${fontFamily.value}"`;
      downloadCtx.fillStyle = fontColor.value || "#000";
      downloadCtx.textAlign = "center";
      downloadCtx.textBaseline = "middle";
      downloadCtx.fillText(displayText, downloadW / 2, downloadH - margin - nameFontSize / 2);
      downloadCtx.restore();
    }

    const url = downloadCanvas.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = url;
    a.download = "my-egg-design.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

previewBtn.onclick = () => { redrawEditCanvas(); renderPreview(); };
downloadBtn.onclick = () => renderDownload();

window.addEventListener('DOMContentLoaded', () => {
  loadAllGalleries();
  redrawEditCanvas();
  renderPreview();
});
