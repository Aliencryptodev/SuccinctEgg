// Dimensions (ampliados para un área de edición y preview más grande y nítida)
const editW = 700, editH = 700, previewW = 1600, previewH = 1120, downloadW = 1000, downloadH = 1000;
const areaNombre = { x: 140, y: 615, w: 420, h: 50 }; // Ajustado para el nuevo tamaño

window.editorBaseImg = window.editorBaseImg || 'assets/eggs/egg_plain.png';
window.previewBandejaImg = window.previewBandejaImg || 'assets/bandejas/bandeja_egg.png';

const editCanvas = document.getElementById('editCanvas');
const editCtx = editCanvas.getContext('2d');
editCanvas.width = editW;
editCanvas.height = editH;

let drawCanvas = document.getElementById('drawCanvas');
let drawCtx = drawCanvas ? drawCanvas.getContext('2d') : null;
if (!drawCanvas) {
  drawCanvas = document.createElement('canvas');
  drawCanvas.id = 'drawCanvas';
  drawCanvas.width = editW;
  drawCanvas.height = editH;
  drawCanvas.style.display = "none";
  document.body.appendChild(drawCanvas);
  drawCtx = drawCanvas.getContext('2d');
}

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

const eyesStickers = Array.from({length: 20}, (_, i) => `assets/stickers/eyes${i+1}.png`);
const mouthStickers = Array.from({length: 20}, (_, i) => `assets/stickers/mouth${i+1}.png`);
const noseStickers = Array.from({length: 20}, (_, i) => `assets/stickers/nose${i+1}.png`);
const glassesStickers = Array.from({length: 20}, (_, i) => `assets/stickers/glasses${i+1}.png`);

let placedStickers = [];
let drawing = false;
let lastX, lastY;

// --- Edit sticker state ---
let selectedStickerIndex = -1;
let dragOffsetX = 0, dragOffsetY = 0;
let resizing = false;
const HANDLE_SIZE = 32; // Más grande para fácil manejo

// --- Inputs events ---
fontFamily.addEventListener('change', () => {
  redrawEditCanvas();
  renderPreview();
});
fontColor.addEventListener('input', () => {
  redrawEditCanvas();
  renderPreview();
});
eggName.addEventListener('input', () => {
  redrawEditCanvas();
  renderPreview();
});

function loadStickerGallery(categoryArray, container) {
  container.innerHTML = "";
  categoryArray.forEach((src) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = "sticker";
    img.style.width = "40px"; // Más grande visual en galería
    img.style.height = "40px";
    img.style.margin = "3px";
    img.onclick = () => {
      addStickerToCanvas(src, false); // Sticker predefinido (no usuario)
      redrawEditCanvas();
      renderPreview();
    };
    container.appendChild(img);
  });
}
function loadAllGalleries() {
  loadStickerGallery(eyesStickers, eyesGallery);
  loadStickerGallery(mouthStickers, mouthGallery);
  loadStickerGallery(noseStickers, noseGallery);
  loadStickerGallery(glassesStickers, glassesGallery);
}
// --- CARGA DE STICKER DE USUARIO ---
uploadSticker.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new window.Image();
    img.onload = () => {
      placedStickers.push({
        img: img,
        x: 100 + Math.random() * 180,
        y: 100 + Math.random() * 180,
        w: Math.min(180, img.width),
        h: Math.min(180, img.height),
        isUserUpload: true // MARCA como imagen subida por usuario
      });
      selectedStickerIndex = placedStickers.length - 1;
      redrawEditCanvas();
      renderPreview();
    };
    img.onerror = () => {
      // Si la imagen falla, no la agregamos
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

// --- STICKER HANDLES & SELECTION ---
function getHandleRect(sticker) {
  // Esquina inferior derecha para redimensionar
  return {
    x: sticker.x + sticker.w - HANDLE_SIZE / 2,
    y: sticker.y + sticker.h - HANDLE_SIZE / 2,
    w: HANDLE_SIZE,
    h: HANDLE_SIZE
  };
}
function getCloseRect(sticker) {
  // Esquina superior izquierda para cerrar
  return {
    x: sticker.x - HANDLE_SIZE / 2,
    y: sticker.y - HANDLE_SIZE / 2,
    w: HANDLE_SIZE,
    h: HANDLE_SIZE
  };
}
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function pointInSticker(x, y, sticker) {
  return x >= sticker.x && x <= sticker.x + sticker.w && y >= sticker.y && y <= sticker.y + sticker.h;
}

// Draw everything on the edit canvas (left side)
function redrawEditCanvas() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    editCtx.drawImage(baseImg, 0, 0, editCanvas.width, editCanvas.height);

    // Freehand drawing
    editCtx.drawImage(drawCanvas, 0, 0);

    // Stickers
    placedStickers.forEach((st, i) => {
      if (
        st.img &&
        st.img.complete &&
        typeof st.img.naturalWidth === "number" &&
        st.img.naturalWidth > 0
      ) {
        try {
          editCtx.drawImage(st.img, st.x, st.y, st.w, st.h);

          if (i === selectedStickerIndex) {
            // Draw selection border
            editCtx.save();
            editCtx.strokeStyle = "#00aaff";
            editCtx.lineWidth = 2.5;
            editCtx.setLineDash([8, 6]);
            editCtx.strokeRect(st.x, st.y, st.w, st.h);
            editCtx.setLineDash([]);

            // Draw resize handle (bottom-right)
            editCtx.fillStyle = "#fff";
            editCtx.strokeStyle = "#00aaff";
            editCtx.lineWidth = 2;
            editCtx.beginPath();
            editCtx.rect(
              st.x + st.w - HANDLE_SIZE / 2,
              st.y + st.h - HANDLE_SIZE / 2,
              HANDLE_SIZE,
              HANDLE_SIZE
            );
            editCtx.fill();
            editCtx.stroke();
            // Draw handle icon
            editCtx.drawImage(getResizeIcon(), st.x + st.w - HANDLE_SIZE / 2 + 5, st.y + st.h - HANDLE_SIZE / 2 + 5, 22, 22);

            // Draw close handle (top-left)
            editCtx.fillStyle = "#fff";
            editCtx.strokeStyle = "#ff4444";
            editCtx.lineWidth = 2;
            editCtx.beginPath();
            editCtx.rect(
              st.x - HANDLE_SIZE / 2,
              st.y - HANDLE_SIZE / 2,
              HANDLE_SIZE,
              HANDLE_SIZE
            );
            editCtx.fill();
            editCtx.stroke();
            // Draw X icon
            editCtx.drawImage(getCloseIcon(), st.x - HANDLE_SIZE / 2 + 5, st.y - HANDLE_SIZE / 2 + 5, 22, 22);

            editCtx.restore();
          }
        } catch (e) {
          // Si drawImage falla, no hacemos nada
          console.warn("No se pudo dibujar un sticker (broken image).", e);
        }
      }
    });

    
  };
  baseImg.onerror = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  };
}

// --- ICONS (resize and close) ---
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

// --- STICKER INTERACTION ---
editCanvas.addEventListener('mousedown', (e) => {
  const [x, y] = getPos(e);

  // Check stickers from top to bottom (topmost first)
  let found = false;
  for (let i = placedStickers.length - 1; i >= 0; i--) {
    const st = placedStickers[i];
    if (i === selectedStickerIndex) {
      // Check resize handle
      if (pointInRect(x, y, getHandleRect(st))) {
        resizing = true;
        dragOffsetX = x - (st.x + st.w);
        dragOffsetY = y - (st.y + st.h);
        found = true;
        break;
      }
      // Check close handle
      if (pointInRect(x, y, getCloseRect(st))) {
        placedStickers.splice(i, 1);
        selectedStickerIndex = -1;
        redrawEditCanvas();
        renderPreview();
        found = true;
        break;
      }
    }
    if (pointInSticker(x, y, st)) {
      selectedStickerIndex = i;
      dragOffsetX = x - st.x;
      dragOffsetY = y - st.y;
      resizing = false;
      found = true;
      redrawEditCanvas();
      break;
    }
  }
  if (!found) {
    selectedStickerIndex = -1;
    redrawEditCanvas();
    // Check if starting to draw (freehand)
    drawing = true;
    [lastX, lastY] = [x, y];
  }
});

editCanvas.addEventListener('mousemove', (e) => {
  const [x, y] = getPos(e);

  if (resizing && selectedStickerIndex !== -1) {
    // Resize sticker
    const st = placedStickers[selectedStickerIndex];
    let newW = x - st.x - dragOffsetX;
    let newH = y - st.y - dragOffsetY;
    // Minimum size
    newW = Math.max(40, newW);
    newH = Math.max(40, newH);

    // Solo limitar si NO es imagen subida por el usuario
    if (!st.isUserUpload) {
      newW = Math.min(editW - st.x, newW);
      newH = Math.min(editH - st.y, newH);
    }

    st.w = newW;
    st.h = newH;
    redrawEditCanvas();
    renderPreview();
    return;
  }

  if (drawing) {
    // Freehand drawing mode
    drawCtx.strokeStyle = brushColor.value;
    drawCtx.lineWidth = brushSize.value;
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(lastX, lastY);
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
    [lastX, lastY] = [x, y];
    redrawEditCanvas();
    renderPreview();
    return;
  }

  // Move sticker
  if (selectedStickerIndex !== -1 && (e.buttons & 1) && !resizing) {
    const st = placedStickers[selectedStickerIndex];
    st.x = x - dragOffsetX;
    st.y = y - dragOffsetY;

    // Solo limitar si NO es imagen subida por el usuario
    if (!st.isUserUpload) {
      st.x = Math.max(0, Math.min(editW - st.w, st.x));
      st.y = Math.max(0, Math.min(editH - st.h, st.y));
    }

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
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  placedStickers = [];
  selectedStickerIndex = -1;
  redrawEditCanvas();
  renderPreview();
});

// Cambiada para aceptar stickers predefinidos y distinguirlos de los del usuario
function addStickerToCanvas(src, isUserUpload = false) {
  const img = new window.Image();
  img.onload = () => {
    placedStickers.push({
      img: img,
      x: 100 + Math.random() * 180,
      y: 100 + Math.random() * 180,
      w: 140,
      h: 140,
      isUserUpload
    });
    selectedStickerIndex = placedStickers.length - 1;
    redrawEditCanvas();
    renderPreview();
  };
  img.onerror = () => {
    // Si la imagen falla, no la agregamos
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

    // Coordenadas del huevo central en la bandeja
    const eggClipArea = {
      x: 641.2,
      y: 459.6,
      w: 329.4,
      h: 329.4
    };

    // --- DIBUJO LIBRE ---
    eggPreviewCtx.save();
    eggPreviewCtx.drawImage(
      drawCanvas,
      0, 0, drawCanvas.width, drawCanvas.height,
      eggClipArea.x, eggClipArea.y, eggClipArea.w, eggClipArea.h
    );
    eggPreviewCtx.restore();

    // --- STICKERS ---
    placedStickers.forEach(st => {
      if (
        st.img &&
        st.img.complete &&
        typeof st.img.naturalWidth === "number" &&
        st.img.naturalWidth > 0
      ) {
        try {
          eggPreviewCtx.drawImage(
            st.img,
            st.x * (eggClipArea.w / editW) + eggClipArea.x,
            st.y * (eggClipArea.h / editH) + eggClipArea.y,
            st.w * (eggClipArea.w / editW),
            st.h * (eggClipArea.h / editH)
          );
        } catch (e) {}
      }
    });

    // --- TEXTO (NOMBRE) ---
    if (eggName.value && eggName.value.trim().length > 0) {
      const nameArea = {
        x: 645.4,
        y: 890,
        w: 288.6,
        h: 56.4
      };
      const margin = 10;
      const nameFontSize = fitTextToWidth(
        eggPreviewCtx,
        eggName.value,
        fontFamily.value,
        nameArea.h - margin,
        nameArea.w - margin * 2,
        12
      );
      const displayText = truncateToFit(
        eggPreviewCtx,
        eggName.value,
        fontFamily.value,
        nameFontSize,
        nameArea.w - margin * 2
      );
      eggPreviewCtx.save();
      eggPreviewCtx.font = `bold ${nameFontSize}px "${fontFamily.value}"`;
      eggPreviewCtx.fillStyle = fontColor.value || "#000";
      eggPreviewCtx.textAlign = "center";
      eggPreviewCtx.textBaseline = "middle";
      eggPreviewCtx.fillText(
        displayText,
        nameArea.x + nameArea.w / 2,
        nameArea.y + nameArea.h / 2
      );
      eggPreviewCtx.restore();
    }
  };
}

// DOWNLOAD: plain color + design, 1000x1000 px
function renderDownload() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = 1000;
    downloadCanvas.height = 1000;
    const downloadCtx = downloadCanvas.getContext('2d');

    // Fondo base
    downloadCtx.drawImage(baseImg, 0, 0, 1000, 1000);

    // --- Áreas corregidas ---
    const zonaDiseno = { x: 50, y: 52, w: 900, h: 796 };  // Cara
    const zonaTexto = { x: 50, y: 880, w: 900, h: 70 };    // Etiqueta ALIEN

    const editW = 700, editH = 700; // área de edición real
    const scaleX = zonaDiseno.w / editW;
    const scaleY = zonaDiseno.h / editH;

    // Dibujo libre perfectamente escalado
    downloadCtx.drawImage(
      drawCanvas,
      0, 0, editW, editH,
      zonaDiseno.x, zonaDiseno.y, zonaDiseno.w, zonaDiseno.h
    );

    // Stickers perfectamente escalados y posicionados
    placedStickers.forEach(st => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        downloadCtx.drawImage(
          st.img,
          zonaDiseno.x + st.x * scaleX,
          zonaDiseno.y + st.y * scaleY,
          st.w * scaleX,
          st.h * scaleY
        );
      }
    });

    // Texto (nombre), centrado en la zona de etiqueta
    if (eggName.value && eggName.value.trim().length > 0) {
      const margin = 10;
      const nameFontSize = fitTextToWidth(
        downloadCtx,
        eggName.value,
        fontFamily.value,
        zonaTexto.h - margin,
        zonaTexto.w - margin * 2,
        12
      );
      const displayText = truncateToFit(
        downloadCtx,
        eggName.value,
        fontFamily.value,
        nameFontSize,
        zonaTexto.w - margin * 2
      );
      downloadCtx.save();
      downloadCtx.font = `bold ${nameFontSize}px "${fontFamily.value}"`;
      downloadCtx.fillStyle = fontColor.value || "#000";
      downloadCtx.textAlign = "center";
      downloadCtx.textBaseline = "middle";
      downloadCtx.fillText(
        displayText,
        zonaTexto.x + zonaTexto.w / 2,
        zonaTexto.y + zonaTexto.h / 0.92
      );
      downloadCtx.restore();
    }

    // Descargar
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