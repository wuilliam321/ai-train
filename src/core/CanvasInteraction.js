// Mouse and keyboard interaction handling
export class CanvasInteraction {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    
    // Interaction states
    this.canvasDragging = false;
    this.itemDragging = false;
    this.resizing = false;
    this.draggedItem = null;
    this.draggedConjunto = null;
    this.resizedConjunto = null;

    this.dragStart = { x: 0, y: 0 };
    this.itemDragOffset = { x: 0, y: 0 };
    this.dragMoveCounter = 0;
    this.highestZIndex = 100;
  }

  setupEventListeners() {
    // Canvas pan y zoom
    this.canvas.container.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    this.canvas.container.addEventListener('wheel', this.handleWheel.bind(this));

    // Búsqueda y filtros
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.canvas.searchFilter.handleSearch(e);
    });
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.canvas.searchFilter.handleCategoryFilter(e);
    });

    // Archivos
    document.getElementById('csvFile').addEventListener('change', (e) => {
      this.canvas.fileHandler.handleCSVUpload(e);
    });
    document.getElementById('jsonFile').addEventListener('change', (e) => {
      this.canvas.fileHandler.handleJSONUpload(e);
    });

    // Prevenir selección de texto
    this.canvas.container.addEventListener('selectstart', e => e.preventDefault());
  }

  handleCanvasMouseDown(e) {
    console.log("🖱️ Mouse down on:", e.target, "className:", e.target.className);
    console.log(`🖱️ Mouse down position: x=${e.clientX}, y=${e.clientY}`);
    
    const item = e.target.closest('.item');
    if (item) {
      console.log("📦 Detected item click");
      this.startItemDrag(e, item);
      return;
    }

    const resizeHandle = e.target.closest('.resize-handle');
    if (resizeHandle) {
      this.startResize(e, resizeHandle);
      return;
    }

    const conjunto = e.target.closest('.conjunto');
    if (conjunto) {
      console.log("📦 Detected conjunto click on:", e.target.tagName, e.target.className);
      
      if (!e.target.closest('.item') && 
          !e.target.matches('input, button') && 
          !e.target.closest('.resize-handle')) {
        console.log("🔄 Iniciando drag de conjunto");
        this.startConjuntoDrag(e, conjunto);
        return;
      } else {
        console.log("❌ Conjunto drag blocked - clicked on:", e.target.tagName);
      }
    }

    if (e.target === this.canvas.container || e.target === this.canvas.workspace) {
      this.startCanvasPan(e);
    }
  }

  startItemDrag(e, item) {
    e.stopPropagation();
    e.preventDefault();

    this.itemDragging = true;
    this.draggedItem = item;
    this.dragMoveCounter = 0;

    const itemId = parseInt(item.dataset.itemId);
    const itemData = this.canvas.getCurrentCanvas().items.find(i => i.id === itemId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === itemData.conjuntoId);
    const initialAbsX = (conjuntoData?.x || 0) + itemData.x;
    const initialAbsY = (conjuntoData?.y || 0) + itemData.y;

    console.log(`-- Drag Start --`);
    console.log(`Item "${itemData.codigo}" initial absolute position: x=${initialAbsX.toFixed(2)}, y=${initialAbsY.toFixed(2)}`);

    const containerRect = this.canvas.container.getBoundingClientRect();
    const canvasData = this.canvas.getCurrentCanvas();

    const workspaceMouseX = (e.clientX - containerRect.left - canvasData.transform.x) / canvasData.transform.scale;
    const workspaceMouseY = (e.clientY - containerRect.top - canvasData.transform.y) / canvasData.transform.scale;

    this.itemDragOffset = {
      x: workspaceMouseX - initialAbsX,
      y: workspaceMouseY - initialAbsY
    };

    this.highestZIndex++;
    item.style.zIndex = this.highestZIndex;
    item.classList.add('dragging');
    this.canvas.updateStatus('Moviendo item...');
  }

  startCanvasPan(e) {
    this.canvasDragging = true;
    this.canvas.container.classList.add('dragging');
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.canvas.updateStatus('Navegando canvas...');
  }

  startResize(e, handle) {
    e.stopPropagation();
    e.preventDefault();

    const conjunto = handle.closest('.conjunto');
    if (!conjunto) return;

    this.resizing = true;
    this.resizedConjunto = conjunto;
    this.resizeCorner = handle.dataset.corner || 'se'; // Default to bottom-right

    const conjuntoId = parseInt(conjunto.dataset.conjuntoId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === conjuntoId);

    this.resizeStart = {
      x: e.clientX,
      y: e.clientY,
      width: conjuntoData.width,
      height: conjuntoData.height,
      left: conjuntoData.x,
      top: conjuntoData.y
    };

    this.canvas.updateStatus(`Redimensionando conjunto (${this.resizeCorner.toUpperCase()})...`);
    console.log(`✅ FIX: Resize iniciado correctamente desde esquina ${this.resizeCorner}`);
  }

  startConjuntoDrag(e, conjunto) {
    e.stopPropagation();
    e.preventDefault();

    this.draggedConjunto = conjunto;
    this.dragStart = { x: e.clientX, y: e.clientY };

    const conjuntoId = parseInt(conjunto.dataset.conjuntoId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === conjuntoId);

    this.conjuntoDragStart = {
      x: conjuntoData.x,
      y: conjuntoData.y
    };

    conjunto.classList.add('dragging-conjunto');
    this.canvas.updateStatus('Moviendo conjunto...');
    console.log(`🔄 Conjunto ${conjuntoId} siendo arrastrado`);
  }

  handleGlobalMouseMove(e) {
    if (this.canvasDragging) {
      this.handleCanvasPan(e);
    } else if (this.itemDragging && this.draggedItem) {
      this.handleItemDrag(e);
    } else if (this.resizing && this.resizedConjunto) {
      this.handleResize(e);
    } else if (this.draggedConjunto) {
      this.handleConjuntoDrag(e);
    }
  }

  handleCanvasPan(e) {
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;

    const canvas = this.canvas.getCurrentCanvas();
    canvas.transform.x += dx;
    canvas.transform.y += dy;

    this.canvas.updateTransform();
    this.dragStart = { x: e.clientX, y: e.clientY };
  }

  handleItemDrag(e) {
    const canvasData = this.canvas.getCurrentCanvas();
    const containerRect = this.canvas.container.getBoundingClientRect();

    const workspaceMouseX = (e.clientX - containerRect.left - canvasData.transform.x) / canvasData.transform.scale;
    const workspaceMouseY = (e.clientY - containerRect.top - canvasData.transform.y) / canvasData.transform.scale;

    const newAbsX = workspaceMouseX - this.itemDragOffset.x;
    const newAbsY = workspaceMouseY - this.itemDragOffset.y;

    const itemId = parseInt(this.draggedItem.dataset.itemId);
    const itemData = this.canvas.getCurrentCanvas().items.find(i => i.id === itemId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === itemData.conjuntoId);

    const newRelativeX = newAbsX - (conjuntoData?.x || 0);
    const newRelativeY = newAbsY - (conjuntoData?.y || 0);

    this.dragMoveCounter++;
    if (this.dragMoveCounter % 15 === 0) {
        console.log(`Item dragging at absolute: x=${newAbsX.toFixed(2)}, y=${newAbsY.toFixed(2)}`);
    }
    
    this.draggedItem.style.left = newRelativeX + 'px';
    this.draggedItem.style.top = newRelativeY + 'px';

    this.highlightConjuntos(e);
  }

  handleResize(e) {
    const dx = (e.clientX - this.resizeStart.x) / this.canvas.getCurrentCanvas().transform.scale;
    const dy = (e.clientY - this.resizeStart.y) / this.canvas.getCurrentCanvas().transform.scale;

    const conjuntoId = parseInt(this.resizedConjunto.dataset.conjuntoId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === conjuntoId);
    if (!conjuntoData) return;

    let newWidth, newHeight, newX, newY;

    // Calculate new dimensions and position based on corner
    switch (this.resizeCorner) {
      case 'nw': // Top-left corner
        newWidth = Math.max(200, this.resizeStart.width - dx);
        newHeight = Math.max(150, this.resizeStart.height - dy);
        newX = this.resizeStart.left + (this.resizeStart.width - newWidth);
        newY = this.resizeStart.top + (this.resizeStart.height - newHeight);
        break;
      
      case 'ne': // Top-right corner
        newWidth = Math.max(200, this.resizeStart.width + dx);
        newHeight = Math.max(150, this.resizeStart.height - dy);
        newX = this.resizeStart.left;
        newY = this.resizeStart.top + (this.resizeStart.height - newHeight);
        break;
      
      case 'sw': // Bottom-left corner
        newWidth = Math.max(200, this.resizeStart.width - dx);
        newHeight = Math.max(150, this.resizeStart.height + dy);
        newX = this.resizeStart.left + (this.resizeStart.width - newWidth);
        newY = this.resizeStart.top;
        break;
      
      case 'se': // Bottom-right corner (default)
      default:
        newWidth = Math.max(200, this.resizeStart.width + dx);
        newHeight = Math.max(150, this.resizeStart.height + dy);
        newX = this.resizeStart.left;
        newY = this.resizeStart.top;
        break;
    }

    // Update DOM element
    this.resizedConjunto.style.width = newWidth + 'px';
    this.resizedConjunto.style.height = newHeight + 'px';
    this.resizedConjunto.style.left = newX + 'px';
    this.resizedConjunto.style.top = newY + 'px';

    // Update data
    conjuntoData.width = newWidth;
    conjuntoData.height = newHeight;
    conjuntoData.x = newX;
    conjuntoData.y = newY;
  }

  handleConjuntoDrag(e) {
    const dx = (e.clientX - this.dragStart.x) / this.canvas.getCurrentCanvas().transform.scale;
    const dy = (e.clientY - this.dragStart.y) / this.canvas.getCurrentCanvas().transform.scale;

    const newX = this.conjuntoDragStart.x + dx;
    const newY = this.conjuntoDragStart.y + dy;

    this.draggedConjunto.style.left = newX + 'px';
    this.draggedConjunto.style.top = newY + 'px';

    const conjuntoId = parseInt(this.draggedConjunto.dataset.conjuntoId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === conjuntoId);
    if (conjuntoData) {
      conjuntoData.x = newX;
      conjuntoData.y = newY;
    }
  }

  handleGlobalMouseUp(e) {
    console.log(`🖱️ Mouse up position: x=${e.clientX}, y=${e.clientY}`);
    
    if (this.canvasDragging) {
      this.canvasDragging = false;
      this.canvas.container.classList.remove('dragging');
      this.canvas.updateStatus('Listo');
    }

    if (this.itemDragging && this.draggedItem) {
      this.finishItemDrag(e);
    }

    if (this.resizing) {
      this.resizing = false;
      this.resizedConjunto = null;
      this.resizeCorner = null;
      this.canvas.updateStatus('Listo');
      console.log('✅ FIX: Resize completado');
      triggerAutoSave();
    }

    if (this.draggedConjunto) {
      this.draggedConjunto.classList.remove('dragging-conjunto');
      this.draggedConjunto = null;
      this.canvas.updateStatus('Listo');
      triggerAutoSave();
    }
  }

  finishItemDrag(e) {
    this.clearConjuntoHighlights();

    const itemId = parseInt(this.draggedItem.dataset.itemId);
    const item = this.canvas.getCurrentCanvas().items.find(i => i.id === itemId);
    
    const canvasData = this.canvas.getCurrentCanvas();
    const containerRect = this.canvas.container.getBoundingClientRect();
    const workspaceMouseX = (e.clientX - containerRect.left - canvasData.transform.x) / canvasData.transform.scale;
    const workspaceMouseY = (e.clientY - containerRect.top - canvasData.transform.y) / canvasData.transform.scale;
    const finalAbsX = workspaceMouseX - this.itemDragOffset.x;
    const finalAbsY = workspaceMouseY - this.itemDragOffset.y;

    let targetConjuntoEl = null;
    this.draggedItem.style.pointerEvents = 'none';
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    this.draggedItem.style.pointerEvents = 'auto';
    if (elementUnderMouse) {
      targetConjuntoEl = elementUnderMouse.closest('.conjunto');
    }
    
    let conjuntoChanged = false;
    const oldConjuntoId = item.conjuntoId;
    let targetConjuntoId = oldConjuntoId;

    if (targetConjuntoEl) {
      targetConjuntoId = parseInt(targetConjuntoEl.dataset.conjuntoId);
    } else {
      targetConjuntoId = 0;
    }

    if (oldConjuntoId !== targetConjuntoId) {
      item.conjuntoId = targetConjuntoId;
      conjuntoChanged = true;
      console.log(`✅ Item ${itemId} movido a conjunto ${targetConjuntoId}`);
    }

    const targetConjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === targetConjuntoId);
    const newRelativeX = finalAbsX - (targetConjuntoData?.x || 0);
    const newRelativeY = finalAbsY - (targetConjuntoData?.y || 0);

    if (item) {
      item.x = newRelativeX;
      item.y = newRelativeY;
      console.log(`-- Drag End --`);
      console.log(`Item "${item.codigo}" final absolute position: x=${finalAbsX.toFixed(2)}, y=${finalAbsY.toFixed(2)}`);
      console.log(`Item "${item.codigo}" final relative position: x=${item.x.toFixed(2)}, y=${item.y.toFixed(2)}`);
    }

    if (conjuntoChanged) {
      const newConjuntoElement = this.canvas.workspace.querySelector(`[data-conjunto-id="${item.conjuntoId}"]`);
      if (newConjuntoElement) {
        newConjuntoElement.appendChild(this.draggedItem);
        
        const conjuntoNameElement = this.draggedItem.querySelector('.item-conjunto');
        if (conjuntoNameElement) {
          conjuntoNameElement.textContent = targetConjuntoData ? targetConjuntoData.name : 'Unknown';
        }
      }
    }

    this.draggedItem.style.left = newRelativeX + 'px';
    this.draggedItem.style.top = newRelativeY + 'px';

    this.draggedItem.classList.remove('dragging');
    this.draggedItem = null;
    this.itemDragging = false;
    this.canvas.updateStatus('Listo');
    
    triggerAutoSave();
  }

  highlightConjuntos(e) {
    document.querySelectorAll('.conjunto').forEach(conjunto => {
      const rect = conjunto.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
        conjunto.classList.add('highlight');
      } else {
        conjunto.classList.remove('highlight');
      }
    });
  }

  clearConjuntoHighlights() {
    document.querySelectorAll('.conjunto').forEach(c =>
      c.classList.remove('highlight')
    );
  }

  handleWheel(e) {
    e.preventDefault();
    const rect = this.canvas.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * 0.1);
    const canvasData = this.canvas.getCurrentCanvas();
    const newScale = Math.max(0.1, Math.min(5, canvasData.transform.scale * zoom));

    const factor = newScale / canvasData.transform.scale;
    canvasData.transform.x = mouseX - (mouseX - canvasData.transform.x) * factor;
    canvasData.transform.y = mouseY - (mouseY - canvasData.transform.y) * factor;
    canvasData.transform.scale = newScale;

    this.canvas.updateTransform();
    this.canvas.updateStatus();
  }
}