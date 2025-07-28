// Dimensions (ampliados para un área de edición y preview más grande y nítida)
const editW = 716, editH = 788, previewW = 1600, previewH = 1120, downloadW = 1000, downloadH = 1000;
const areaNombre = { x: 140, y: 615, w: 420, h: 50 }; // Ajustado para el nuevo tamaño

// ✅ ZONAS PERMITIDAS - Ajustadas correctamente para el huevo
const WORK_ZONES = {
  // Porcentajes para la zona de trabajo (cara del huevo) - CORREGIDOS
  design: {
    x: 0,      // 21% margen izquierdo 
    y: 0,      // 27% margen superior 
    w: 1,      // 58% ancho 
    h: 1      // 50% altura 
  },
  // Porcentajes para la zona de texto (nombre)
  text: {
    x: 0.21,      // 21% margen izquierdo (igual que design)
    y: 0.85,      // 85% desde arriba
    w: 0.58,      // 58% ancho (igual que design)
    h: 0.08       // 8% altura
  }
};

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

// ✅ FUNCIÓN: Obtener coordenadas reales de las zonas
function getWorkZones(canvasWidth, canvasHeight) {
  return {
    design: {
      x: Math.round(canvasWidth * WORK_ZONES.design.x),
      y: Math.round(canvasHeight * WORK_ZONES.design.y),
      w: Math.round(canvasWidth * WORK_ZONES.design.w),
      h: Math.round(canvasHeight * WORK_ZONES.design.h)
    },
    text: {
      x: Math.round(canvasWidth * WORK_ZONES.text.x),
      y: Math.round(canvasHeight * WORK_ZONES.text.y),
      w: Math.round(canvasWidth * WORK_ZONES.text.w),
      h: Math.round(canvasHeight * WORK_ZONES.text.h)
    }
  };
}

// ✅ FUNCIÓN: Verificar si un punto está dentro de la zona de trabajo
function isPointInWorkZone(x, y) {
  const zones = getWorkZones(editW, editH);
  const designZone = zones.design;
  
  return x >= designZone.x && 
         x <= designZone.x + designZone.w && 
         y >= designZone.y && 
         y <= designZone.y + designZone.h;
}

// ✅ FUNCIÓN: Limitar coordenadas a la zona de trabajo
function constrainToWorkZone(x, y, width = 0, height = 0) {
  const zones = getWorkZones(editW, editH);
  const designZone = zones.design;
  
  const constrainedX = Math.max(
    designZone.x,
    Math.min(designZone.x + designZone.w - width, x)
  );
  
  const constrainedY = Math.max(
    designZone.y,
    Math.min(designZone.y + designZone.h - height, y)
  );
  
  return [constrainedX, constrainedY];
}

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
      const zones = getWorkZones(editW, editH);
      const designZone = zones.design;
      
      // ✅ POSICIÓN INICIAL dentro de la zona de trabajo
      const initialX = designZone.x + Math.random() * (designZone.w - 180);
      const initialY = designZone.y + Math.random() * (designZone.h - 180);
      
      placedStickers.push({
        img: img,
        x: Math.max(designZone.x, initialX),
        y: Math.max(designZone.y, initialY),
        w: Math.min(180, img.width),
        h: Math.min(180, img.height),
        isUserUpload: true // MARCA como imagen subida por usuario
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

function getPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * editCanvas.width / rect.width,
    (e.clientY - rect.top) * editCanvas.height / rect.height
  ];
}

// ✅ FUNCIÓN: addStickerToCanvas con posición limitada
function addStickerToCanvas(src, isUserUpload = false) {
  const img = new window.Image();
  img.onload = () => {
    const zones = getWorkZones(editW, editH);
    const designZone = zones.design;
    
    // ✅ POSICIÓN INICIAL dentro de la zona de trabajo
    const initialX = designZone.x + Math.random() * (designZone.w - 140);
    const initialY = designZone.y + Math.random() * (designZone.h - 140);
    
    placedStickers.push({
      img: img,
      x: Math.max(designZone.x, initialX),
      y: Math.max(designZone.y, initialY),
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

// ✅ EDITOR: Función redrawEditCanvas con límites CORREGIDOS
function redrawEditCanvas() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    editCtx.drawImage(baseImg, 0, 0, editCanvas.width, editCanvas.height);

    const zones = getWorkZones(editW, editH);
    const designZone = zones.design;

    // ✅ APLICAR CLIPPING a la zona de trabajo
    editCtx.save();
    editCtx.beginPath();
    editCtx.rect(designZone.x, designZone.y, designZone.w, designZone.h);
    editCtx.clip();

    // Dibujo libre (solo dentro de la zona)
    editCtx.drawImage(drawCanvas, 0, 0);

    // Stickers (solo dentro de la zona)
    placedStickers.forEach((st, i) => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        try {
          editCtx.drawImage(st.img, st.x, st.y, st.w, st.h);
        } catch (e) {
          console.warn("Error dibujando sticker:", e);
        }
      }
    });

    editCtx.restore();

    // ✅ DIBUJAR HANDLES de selección (FUERA del clipping)
    placedStickers.forEach((st, i) => {
      if (i === selectedStickerIndex && st.img && st.img.complete) {
        editCtx.save();
        // Draw selection border
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
    });

    // ✅ MOSTRAR límites de zona de trabajo para debug
    editCtx.strokeStyle = "#0066ff";
    editCtx.lineWidth = 2;
    editCtx.setLineDash([5, 5]);
    editCtx.strokeRect(designZone.x, designZone.y, designZone.w, designZone.h);
    editCtx.setLineDash([]);
  };
  baseImg.onerror = () => {
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  };
}

// ✅ EVENTOS: mousedown con límites
editCanvas.addEventListener('mousedown', (e) => {
  const [x, y] = getPos(e);

  // ✅ SOLO permitir interacción dentro de la zona de trabajo
  if (!isPointInWorkZone(x, y)) {
    return; // Ignorar clics fuera de la zona
  }

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

// ✅ EVENTOS: mousemove con límites
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

    // ✅ LIMITAR redimensionado a la zona de trabajo
    const zones = getWorkZones(editW, editH);
    const designZone = zones.design;
    
    newW = Math.min(designZone.x + designZone.w - st.x, newW);
    newH = Math.min(designZone.y + designZone.h - st.y, newH);

    st.w = newW;
    st.h = newH;
    redrawEditCanvas();
    renderPreview();
    return;
  }

  if (drawing) {
    // ✅ SOLO dibujar dentro de la zona de trabajo
    if (isPointInWorkZone(x, y) && isPointInWorkZone(lastX, lastY)) {
      drawCtx.strokeStyle = brushColor.value;
      drawCtx.lineWidth = brushSize.value;
      drawCtx.lineCap = "round";
      drawCtx.lineJoin = "round";
      drawCtx.beginPath();
      drawCtx.moveTo(lastX, lastY);
      drawCtx.lineTo(x, y);
      drawCtx.stroke();
      redrawEditCanvas();
      renderPreview();
    }
    [lastX, lastY] = [x, y];
    return;
  }

  // ✅ MOVER sticker con límites
  if (selectedStickerIndex !== -1 && (e.buttons & 1) && !resizing) {
    const st = placedStickers[selectedStickerIndex];
    const newX = x - dragOffsetX;
    const newY = y - dragOffsetY;
    
    // ✅ CONSTRAÑIR posición a la zona de trabajo
    [st.x, st.y] = constrainToWorkZone(newX, newY, st.w, st.h);
    
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

// ✅ PREVISUALIZACIÓN: renderPreview con límites
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

    // ✅ APLICAR CLIPPING también en preview
    eggPreviewCtx.save();
    eggPreviewCtx.beginPath();
    eggPreviewCtx.ellipse(
      eggClipArea.x + eggClipArea.w/2, 
      eggClipArea.y + eggClipArea.h/2, 
      eggClipArea.w/2, 
      eggClipArea.h/2, 
      0, 0, 2 * Math.PI
    );
    eggPreviewCtx.clip();

    // Calcular escalas para mapear desde zona de trabajo a preview
    const zones = getWorkZones(editW, editH);
    const designZone = zones.design;
    
    const scaleX = eggClipArea.w / designZone.w;
    const scaleY = eggClipArea.h / designZone.h;
    const offsetX = eggClipArea.x - (designZone.x * scaleX);
    const offsetY = eggClipArea.y - (designZone.y * scaleY);

    // --- DIBUJO LIBRE ---
    eggPreviewCtx.drawImage(
      drawCanvas,
      designZone.x, designZone.y, designZone.w, designZone.h,
      eggClipArea.x, eggClipArea.y, eggClipArea.w, eggClipArea.h
    );

    // --- STICKERS ---
    placedStickers.forEach(st => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        try {
          eggPreviewCtx.drawImage(
            st.img,
            offsetX + st.x * scaleX,
            offsetY + st.y * scaleY,
            st.w * scaleX,
            st.h * scaleY
          );
        } catch (e) {}
      }
    });

    eggPreviewCtx.restore();

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

// ✅ DESCARGA: renderDownload con límites
function renderDownload() {
  const baseImg = new window.Image();
  baseImg.src = window.editorBaseImg;
  baseImg.onload = () => {
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = downloadW;
    downloadCanvas.height = downloadH;
    const downloadCtx = downloadCanvas.getContext('2d');

    // Fondo base
    downloadCtx.drawImage(baseImg, 0, 0, downloadW, downloadH);

    const zones = getWorkZones(downloadW, downloadH);
    const designZone = zones.design;
    const textZone = zones.text;

    // ✅ CLIPPING para zona de diseño
    downloadCtx.save();
    downloadCtx.beginPath();
    downloadCtx.rect(designZone.x, designZone.y, designZone.w, designZone.h);
    downloadCtx.clip();

    // Escalas para mapear desde editor a descarga
    const editZones = getWorkZones(editW, editH);
    const editDesignZone = editZones.design;
    
    const scaleX = designZone.w / editDesignZone.w;
    const scaleY = designZone.h / editDesignZone.h;
    const offsetX = designZone.x - (editDesignZone.x * scaleX);
    const offsetY = designZone.y - (editDesignZone.y * scaleY);

    // Dibujo libre
    downloadCtx.drawImage(
      drawCanvas,
      editDesignZone.x, editDesignZone.y, editDesignZone.w, editDesignZone.h,
      designZone.x, designZone.y, designZone.w, designZone.h
    );

    // Stickers
    placedStickers.forEach(st => {
      if (st.img && st.img.complete && st.img.naturalWidth > 0) {
        try {
          downloadCtx.drawImage(
            st.img,
            offsetX + st.x * scaleX,
            offsetY + st.y * scaleY,
            st.w * scaleX,
            st.h * scaleY
          );
        } catch (e) {
          console.warn("Error dibujando sticker en descarga:", e);
        }
      }
    });

    downloadCtx.restore();

    // ✅ TEXTO con clipping
    if (eggName.value && eggName.value.trim().length > 0) {
      downloadCtx.save();
      downloadCtx.beginPath();
      downloadCtx.rect(textZone.x, textZone.y, textZone.w, textZone.h);
      downloadCtx.clip();
      
      const margin = Math.round(downloadW * 0.015);
      const baseFontSize = Math.round(textZone.h * 0.6);
      
      const nameFontSize = fitTextToWidth(
        downloadCtx,
        eggName.value,
        fontFamily.value,
        baseFontSize,
        textZone.w - margin * 2,
        Math.round(downloadW * 0.02)
      );
      
      const displayText = truncateToFit(
        downloadCtx,
        eggName.value,
        fontFamily.value,
        nameFontSize,
        textZone.w - margin * 2
      );
      
      downloadCtx.font = `bold ${nameFontSize}px "${fontFamily.value}"`;
      downloadCtx.fillStyle = fontColor.value || "#000";
      downloadCtx.textAlign = "center";
      downloadCtx.textBaseline = "middle";
      downloadCtx.fillText(
        displayText,
        textZone.x + textZone.w / 2,
        textZone.y + textZone.h / 2
      );
      
      downloadCtx.restore();
    }

    // Descargar
    const url = downloadCanvas.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = url;
    a.download = `egg-design-${downloadW}x${downloadH}.png`;
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
