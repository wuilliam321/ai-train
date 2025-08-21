// Keyboard shortcuts and hotkeys
export class KeyboardShortcuts {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.selectedItems = new Set();
    this.clipboard = [];
    this.undoStack = [];
    this.redoStack = [];
  }

  setupAdvancedEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.code;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (ctrlOrMeta) {
        switch (key) {
          case 'KeyA':
            e.preventDefault();
            this.selectAllItems();
            break;
          case 'KeyC':
            e.preventDefault();
            this.copySelectedItems();
            break;
          case 'KeyV':
            e.preventDefault();
            this.pasteItems();
            break;
          case 'KeyS':
            e.preventDefault();
            if (this.canvas.autoSave) {
              this.canvas.autoSave.save();
              this.canvas.autoSave.showNotification('Canvas guardado manualmente', 'success');
            }
            break;
          case 'KeyZ':
            e.preventDefault();
            this.undo();
            break;
          case 'KeyY':
            e.preventDefault();
            this.redo();
            break;
          case 'Plus':
          case 'Equal':
            e.preventDefault();
            this.canvas.zoomIn();
            break;
          case 'Minus':
            e.preventDefault();
            this.canvas.zoomOut();
            break;
          case 'Digit0':
            e.preventDefault();
            this.canvas.resetZoom();
            break;
          case 'KeyO':
            e.preventDefault();
            document.getElementById('jsonFile').click();
            break;
        }
      } else {
        switch (key) {
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            this.deleteSelectedItems();
            break;
          case 'Escape':
            this.clearSelection();
            this.canvas.closeModal('conjuntoModal');
            this.canvas.closeModal('canvasModal');
            break;
        }
      }
    });

    this.canvas.container.addEventListener('mousedown', (e) => {
      if (e.target === this.canvas.container || e.target === this.canvas.workspace) {
        this.clearSelection();
      }
    });

    console.log('✅ FASE 3: Event listeners avanzados configurados');
  }

  // --- Selection ---
  selectAllItems() {
    this.clearSelection();
    const canvasData = this.canvas.getCurrentCanvas();
    canvasData.items.forEach(item => {
      const itemElement = this.canvas.workspace.querySelector(`[data-item-id="${item.id}"]`);
      if (itemElement && itemElement.style.display !== 'none') {
        this.selectedItems.add(item.id);
        itemElement.classList.add('selected');
      }
    });
    this.canvas.updateStatus(`${this.selectedItems.size} items seleccionados`);
  }

  clearSelection() {
    this.selectedItems.forEach(itemId => {
      const itemElement = this.canvas.workspace.querySelector(`[data-item-id="${itemId}"]`);
      if (itemElement) {
        itemElement.classList.remove('selected');
      }
    });
    this.selectedItems.clear();
    this.canvas.updateStatus('Selección limpiada');
  }

  // --- Clipboard ---
  copySelectedItems() {
    if (this.selectedItems.size === 0) return;
    const canvasData = this.canvas.getCurrentCanvas();
    this.clipboard = Array.from(this.selectedItems).map(id => {
      const item = canvasData.items.find(i => i.id === id);
      return JSON.parse(JSON.stringify(item)); // Deep copy
    });
    this.canvas.updateStatus(`${this.clipboard.length} items copiados`);
  }

  pasteItems() {
    if (this.clipboard.length === 0) return;
    this.pushStateToUndoStack('Paste Items');
    const canvasData = this.canvas.getCurrentCanvas();
    const newItems = this.clipboard.map(item => {
      const newItem = { ...item };
      newItem.id = this.canvas.nextItemId++;
      newItem.x += 20;
      newItem.y += 20;
      return newItem;
    });
    canvasData.items.push(...newItems);
    this.clearSelection();
    newItems.forEach(item => this.selectedItems.add(item.id));
    this.canvas.render();
    this.canvas.updateStatus(`${newItems.length} items pegados`);
  }

  // --- Deletion ---
  deleteSelectedItems() {
    if (this.selectedItems.size === 0) return;
    if (confirm(`¿Eliminar ${this.selectedItems.size} item(s) seleccionado(s)?`)) {
      this.pushStateToUndoStack('Delete Items');
      const canvasData = this.canvas.getCurrentCanvas();
      const deletedCount = this.selectedItems.size;
      canvasData.items = canvasData.items.filter(item => !this.selectedItems.has(item.id));
      this.selectedItems.clear();
      this.canvas.render();
      this.canvas.updateStatus(`${deletedCount} items eliminados`);
    }
  }

  // --- Undo/Redo ---
  pushStateToUndoStack(actionName) {
    const currentState = JSON.stringify(this.canvas.getCurrentCanvas());
    this.undoStack.push({ action: actionName, state: currentState });
    this.redoStack = []; // Clear redo stack on new action
    if (this.undoStack.length > 30) {
      this.undoStack.shift(); // Limit history size
    }
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.canvas.updateStatus('Nada que deshacer');
      return;
    }
    const lastState = this.undoStack.pop();
    const currentState = JSON.stringify(this.canvas.getCurrentCanvas());
    this.redoStack.push({ action: 'Redo ' + lastState.action, state: currentState });

    this.restoreState(lastState.state);
    this.canvas.updateStatus(`Deshecho: ${lastState.action}`);
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.canvas.updateStatus('Nada que rehacer');
      return;
    }
    const nextState = this.redoStack.pop();
    const currentState = JSON.stringify(this.canvas.getCurrentCanvas());
    this.undoStack.push({ action: 'Undo ' + nextState.action, state: currentState });

    this.restoreState(nextState.state);
    this.canvas.updateStatus(`Rehecho: ${nextState.action}`);
  }

  restoreState(stateString) {
    const state = JSON.parse(stateString);
    const currentCanvas = this.canvas.getCurrentCanvas();
    currentCanvas.items = state.items;
    currentCanvas.conjuntos = state.conjuntos;
    currentCanvas.transform = state.transform;
    this.canvas.render();
  }
}
