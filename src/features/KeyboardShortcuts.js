// Keyboard shortcuts and hotkeys
// 
// Note: Uses e.key instead of e.code for keyboard layout independence (supports Dvorak, etc.)
//
// Available shortcuts:
// - Ctrl+A: Select all items
// - Ctrl+C: Copy selected items
// - Ctrl+X: Cut selected items  
// - Ctrl+V: Paste items
// - Ctrl+S: Save manually
// - Ctrl+Z: Undo
// - Ctrl+Y or Ctrl+Shift+Z: Redo
// - Ctrl+D: Duplicate selected items
// - Ctrl+O: Open file dialog
// - Ctrl++ / Ctrl+=: Zoom in
// - Ctrl+-: Zoom out
// - Ctrl+0: Reset zoom
// - Delete/Backspace: Delete selected items
// - Escape: Clear selection and close modals
// - F11: Toggle fullscreen
// - Space: Pan mode (hold and move mouse to navigate)
//
// Mouse interaction:
// - Ctrl+click on item: Toggle item selection
// - Ctrl+click on conjunto: Select all items in conjunto
// - Click on empty space: Clear selection
//
export class KeyboardShortcuts {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.selectedItems = new Set();
    this.clipboard = [];
    this.undoStack = [];
    this.redoStack = [];
    this.lastMousePosition = { x: 0, y: 0 }; // Track mouse position for smart paste
  }

  setupAdvancedEventListeners() {
    // Track mouse position for smart paste functionality
    this.canvas.container.addEventListener('mousemove', (e) => {
      this.lastMousePosition.x = e.clientX;
      this.lastMousePosition.y = e.clientY;
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      const code = e.code;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      
      console.log(`🎹 Keyboard event: key='${e.key}', code='${code}', Ctrl: ${ctrlOrMeta}, Shift: ${shift}`);

      if (ctrlOrMeta) {
        switch (key) {
          case 'a':
            console.log('🔧 SHORTCUT: Ctrl+A - Select All Items');
            e.preventDefault();
            this.selectAllItems();
            break;
          case 'c':
            console.log('🔧 SHORTCUT: Ctrl+C - Copy Selected Items');
            e.preventDefault();
            this.copySelectedItems();
            break;
          case 'x':
            console.log('🔧 SHORTCUT: Ctrl+X - Cut Selected Items');
            e.preventDefault();
            this.cutSelectedItems();
            break;
          case 'v':
            console.log('🔧 SHORTCUT: Ctrl+V - Smart Paste Items');
            e.preventDefault();
            this.smartPasteItems();
            break;
          case 's':
            console.log('🔧 SHORTCUT: Ctrl+S - Save Manually');
            e.preventDefault();
            if (this.canvas.autoSave) {
              this.canvas.autoSave.save();
              this.canvas.autoSave.showNotification('Canvas guardado manualmente', 'success');
            }
            break;
          case 'z':
            e.preventDefault();
            if (shift) {
              console.log('🔧 SHORTCUT: Ctrl+Shift+Z - Redo');
              this.redo();
            } else {
              console.log('🔧 SHORTCUT: Ctrl+Z - Undo');
              this.undo();
            }
            break;
          case 'y':
            console.log('🔧 SHORTCUT: Ctrl+Y - Redo');
            e.preventDefault();
            this.redo();
            break;
          case '+':
          case '=':
            console.log('🔧 SHORTCUT: Ctrl++ - Zoom In');
            e.preventDefault();
            this.canvas.zoomIn();
            break;
          case '-':
            console.log('🔧 SHORTCUT: Ctrl+- - Zoom Out');
            e.preventDefault();
            this.canvas.zoomOut();
            break;
          case '0':
            console.log('🔧 SHORTCUT: Ctrl+0 - Reset Zoom');
            e.preventDefault();
            this.canvas.resetZoom();
            break;
          case 'o':
            console.log('🔧 SHORTCUT: Ctrl+O - Open File');
            e.preventDefault();
            document.getElementById('jsonFile')?.click();
            break;
          case 'd':
            console.log('🔧 SHORTCUT: Ctrl+D - Duplicate Selected Items');
            e.preventDefault();
            this.duplicateSelectedItems();
            break;
          default:
            console.log(`🎹 Unhandled Ctrl+${key} combination`);
            break;
        }
      } else {
        switch (key) {
          case 'delete':
          case 'backspace':
            console.log('🔧 SHORTCUT: Delete/Backspace - Delete Selected Items');
            e.preventDefault();
            this.deleteSelectedItems();
            break;
          case 'escape':
            console.log('🔧 SHORTCUT: Escape - Clear Selection and Close Modals');
            e.preventDefault();
            this.clearSelection();
            this.canvas.closeModal?.('conjuntoModal');
            this.canvas.closeModal?.('canvasModal');
            break;
          case 'f11':
            console.log('🔧 SHORTCUT: F11 - Toggle Fullscreen');
            e.preventDefault();
            this.toggleFullscreen();
            break;
          case ' ':
            if (!e.target.closest('input, textarea, [contenteditable]')) {
              console.log('🔧 SHORTCUT: Space - Start Pan Mode');
              e.preventDefault();
              this.canvas.interaction?.startPan();
            }
            break;
          default:
            console.log(`🎹 Unhandled ${key} key`);
            break;
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.canvas.interaction?.isPanning) {
        console.log('🔧 SHORTCUT: Space Released - Stop Pan Mode');
        this.canvas.interaction.stopPan();
      }
    });

    this.canvas.container.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    console.log('✅ FASE 3: Event listeners avanzados configurados');
  }

  // --- Mouse Selection ---
  handleMouseDown(e) {
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    console.log(`🖱️  Mouse down - Ctrl: ${ctrlOrMeta}, Target:`, e.target.className);

    // Handle Ctrl+click functionality
    if (ctrlOrMeta) {
      this.handleCtrlClick(e);
      return;
    }

    // Regular click - clear selection if clicking on empty space
    if (e.target === this.canvas.container || e.target === this.canvas.workspace) {
      console.log('🖱️  Clicked on empty space - clearing selection');
      this.clearSelection();
    }
  }

  handleCtrlClick(e) {
    console.log('🖱️  Ctrl+Click detected');
    
    // Find closest item or conjunto
    const itemElement = e.target.closest('.item');
    const conjuntoElement = e.target.closest('.conjunto');

    if (itemElement) {
      const itemId = parseInt(itemElement.dataset.itemId);
      console.log(`🖱️  Ctrl+Click on item ${itemId}`);
      this.toggleItemSelection(itemId);
    } else if (conjuntoElement) {
      const conjuntoId = parseInt(conjuntoElement.dataset.conjuntoId);
      console.log(`🖱️  Ctrl+Click on conjunto ${conjuntoId}`);
      this.selectAllItemsInConjunto(conjuntoId);
    } else {
      console.log('🖱️  Ctrl+Click on empty space - no action');
    }
  }

  toggleItemSelection(itemId) {
    const itemElement = this.canvas.workspace.querySelector(`[data-item-id="${itemId}"]`);
    if (!itemElement) return;

    if (this.selectedItems.has(itemId)) {
      console.log(`🔄 Deselecting item ${itemId}`);
      this.selectedItems.delete(itemId);
      itemElement.classList.remove('selected');
    } else {
      console.log(`🔄 Selecting item ${itemId}`);
      this.selectedItems.add(itemId);
      itemElement.classList.add('selected');
    }
    
    this.canvas.updateStatus(`${this.selectedItems.size} items seleccionados`);
  }

  selectAllItemsInConjunto(conjuntoId) {
    const canvasData = this.canvas.getCurrentCanvas();
    const itemsInConjunto = canvasData.items.filter(item => item.conjuntoId === conjuntoId);
    
    console.log(`🔄 Selecting all ${itemsInConjunto.length} items in conjunto ${conjuntoId}`);
    
    itemsInConjunto.forEach(item => {
      const itemElement = this.canvas.workspace.querySelector(`[data-item-id="${item.id}"]`);
      if (itemElement && itemElement.style.display !== 'none') {
        this.selectedItems.add(item.id);
        itemElement.classList.add('selected');
      }
    });
    
    this.canvas.updateStatus(`${this.selectedItems.size} items seleccionados`);
  }

  // --- Selection ---
  selectAllItems() {
    console.log('🔄 Selecting all items');
    
    // Clear current selection efficiently
    this.canvas.clearAllSelections();
    this.selectedItems.clear();
    
    // Select all visible items efficiently
    const selectedCount = this.canvas.selectAllVisibleItems();
    
    // Update selectedItems set
    const canvasData = this.canvas.getCurrentCanvas();
    canvasData.items.forEach(item => {
      const itemElement = this.canvas.workspace.querySelector(`[data-item-id="${item.id}"]`);
      if (itemElement && itemElement.style.display !== 'none') {
        this.selectedItems.add(item.id);
      }
    });
    
    this.canvas.updateStatus(`${selectedCount} items seleccionados`);
  }

  clearSelection() {
    console.log(`🔄 Clearing selection (${this.selectedItems.size} items)`);
    
    // Clear selections efficiently
    this.canvas.clearAllSelections();
    this.selectedItems.clear();
    
    this.canvas.updateStatus('Selección limpiada');
  }

  // --- Clipboard ---
  copySelectedItems() {
    if (this.selectedItems.size === 0) {
      console.log('📋 Copy: No items selected');
      return;
    }
    const canvasData = this.canvas.getCurrentCanvas();
    this.clipboard = Array.from(this.selectedItems).map(id => {
      const item = canvasData.items.find(i => i.id === id);
      return JSON.parse(JSON.stringify(item)); // Deep copy
    });
    console.log(`📋 Copied ${this.clipboard.length} items to clipboard`);
    this.canvas.updateStatus(`${this.clipboard.length} items copiados`);
  }

  cutSelectedItems() {
    if (this.selectedItems.size === 0) {
      console.log('✂️ Cut: No items selected');
      return;
    }
    console.log(`✂️ Cutting ${this.selectedItems.size} selected items`);
    
    // First copy the items to clipboard
    this.copySelectedItems();
    
    // Then delete the selected items
    this.pushStateToUndoStack('Cut Items');
    const canvasData = this.canvas.getCurrentCanvas();
    const cutCount = this.selectedItems.size;
    const itemIdsToRemove = Array.from(this.selectedItems);
    
    // Remove from data
    canvasData.items = canvasData.items.filter(item => !this.selectedItems.has(item.id));
    
    // Remove from DOM efficiently
    this.canvas.removeItemsFromDOM(itemIdsToRemove);
    
    this.selectedItems.clear();
    console.log(`✂️ Successfully cut ${cutCount} items`);
    this.canvas.updateStatus(`${cutCount} items cortados`);
  }

  pasteItems() {
    if (this.clipboard.length === 0) {
      console.log('📋 Paste: Clipboard is empty');
      return;
    }
    console.log(`📋 Pasting ${this.clipboard.length} items from clipboard`);
    this.pushStateToUndoStack('Paste Items');
    const canvasData = this.canvas.getCurrentCanvas();
    const newItems = this.clipboard.map(item => {
      const newItem = { ...item };
      newItem.id = this.canvas.nextItemId++;
      newItem.x += 20;
      newItem.y += 20;
      return newItem;
    });
    
    // Add to data
    canvasData.items.push(...newItems);
    
    // Clear current selection efficiently
    this.canvas.clearAllSelections();
    this.selectedItems.clear();
    
    // Add to DOM efficiently
    this.canvas.addItemsToDOM(newItems);
    
    // Select new items efficiently
    newItems.forEach(item => {
      this.selectedItems.add(item.id);
      this.canvas.updateItemSelection(item.id, true);
    });
    
    console.log(`📋 Pasted and selected ${newItems.length} new items`);
    this.canvas.updateStatus(`${newItems.length} items pegados`);
  }

  pasteItemsAtPosition(clientX, clientY) {
    if (this.clipboard.length === 0) {
      console.log('📋 Paste at position: Clipboard is empty');
      return;
    }
    
    // Convert screen coordinates to canvas coordinates
    const containerRect = this.canvas.container.getBoundingClientRect();
    const canvasData = this.canvas.getCurrentCanvas();
    const canvasX = (clientX - containerRect.left - canvasData.transform.x) / canvasData.transform.scale;
    const canvasY = (clientY - containerRect.top - canvasData.transform.y) / canvasData.transform.scale;
    
    console.log(`📋 Pasting ${this.clipboard.length} items at canvas position (${canvasX.toFixed(2)}, ${canvasY.toFixed(2)})`);
    this.pushStateToUndoStack('Paste Items at Position');
    
    const newItems = this.clipboard.map((item, index) => {
      const newItem = { ...item };
      newItem.id = this.canvas.nextItemId++;
      newItem.x = canvasX + (index * 20); // Offset multiple items slightly
      newItem.y = canvasY + (index * 20);
      newItem.conjuntoId = 0; // Place in default conjunto unless specified
      return newItem;
    });
    
    // Add to data
    canvasData.items.push(...newItems);
    
    // Clear current selection efficiently
    this.canvas.clearAllSelections();
    this.selectedItems.clear();
    
    // Add to DOM efficiently
    this.canvas.addItemsToDOM(newItems);
    
    // Select new items efficiently
    newItems.forEach(item => {
      this.selectedItems.add(item.id);
      this.canvas.updateItemSelection(item.id, true);
    });
    
    console.log(`📋 Pasted and selected ${newItems.length} new items at cursor position`);
    this.canvas.updateStatus(`${newItems.length} items pegados en cursor`);
  }

  pasteItemsToConjunto(conjuntoId, clientX, clientY) {
    if (this.clipboard.length === 0) {
      console.log('📋 Paste to conjunto: Clipboard is empty');
      return;
    }
    
    const canvasData = this.canvas.getCurrentCanvas();
    const conjunto = canvasData.conjuntos.find(c => c.id === conjuntoId);
    if (!conjunto) {
      console.log(`📋 Paste to conjunto: Conjunto ${conjuntoId} not found`);
      return;
    }
    
    // Convert screen coordinates to canvas coordinates relative to the conjunto
    const containerRect = this.canvas.container.getBoundingClientRect();
    const canvasX = (clientX - containerRect.left - canvasData.transform.x) / canvasData.transform.scale;
    const canvasY = (clientY - containerRect.top - canvasData.transform.y) / canvasData.transform.scale;
    
    // Convert to conjunto-relative coordinates
    const relativeX = canvasX - conjunto.x;
    const relativeY = canvasY - conjunto.y;
    
    console.log(`📋 Pasting ${this.clipboard.length} items to conjunto "${conjunto.name}" at relative position (${relativeX.toFixed(2)}, ${relativeY.toFixed(2)})`);
    this.pushStateToUndoStack('Paste Items to Conjunto');
    
    const newItems = this.clipboard.map((item, index) => {
      const newItem = { ...item };
      newItem.id = this.canvas.nextItemId++;
      newItem.x = relativeX + (index * 20); // Offset multiple items slightly
      newItem.y = relativeY + (index * 20);
      newItem.conjuntoId = conjuntoId; // Assign to the target conjunto
      return newItem;
    });
    
    // Add to data
    canvasData.items.push(...newItems);
    
    // Clear current selection efficiently
    this.canvas.clearAllSelections();
    this.selectedItems.clear();
    
    // Add to DOM efficiently
    this.canvas.addItemsToDOM(newItems);
    
    // Select new items efficiently
    newItems.forEach(item => {
      this.selectedItems.add(item.id);
      this.canvas.updateItemSelection(item.id, true);
    });
    
    console.log(`📋 Pasted and selected ${newItems.length} new items to conjunto "${conjunto.name}"`);
    this.canvas.updateStatus(`${newItems.length} items pegados en ${conjunto.name}`);
  }

  // Smart paste that detects context (conjunto vs canvas)
  smartPasteItems() {
    if (this.clipboard.length === 0) {
      console.log('📋 Smart Paste: Clipboard is empty');
      return;
    }

    // Get the element under the current mouse position
    const elementUnderMouse = document.elementFromPoint(this.lastMousePosition.x, this.lastMousePosition.y);
    const conjuntoElement = elementUnderMouse?.closest('.conjunto');
    
    if (conjuntoElement) {
      // We're over a conjunto, paste into it
      const conjuntoId = parseInt(conjuntoElement.dataset.conjuntoId);
      const canvasData = this.canvas.getCurrentCanvas();
      const conjunto = canvasData.conjuntos.find(c => c.id === conjuntoId);
      
      if (conjunto) {
        console.log(`📋 Smart Paste: Detected hover over conjunto "${conjunto.name}" (ID: ${conjuntoId}), pasting into it`);
        this.pasteItemsToConjunto(conjuntoId, this.lastMousePosition.x, this.lastMousePosition.y);
        return;
      }
    }
    
    // Default behavior: paste at cursor position on canvas
    console.log('📋 Smart Paste: No conjunto detected, pasting at cursor position');
    this.pasteItemsAtPosition(this.lastMousePosition.x, this.lastMousePosition.y);
  }

  // --- Deletion ---
  deleteSelectedItems() {
    if (this.selectedItems.size === 0) {
      console.log('🗑️  Delete: No items selected');
      return;
    }
    console.log(`🗑️  Attempting to delete ${this.selectedItems.size} selected items`);
    if (confirm(`¿Eliminar ${this.selectedItems.size} item(s) seleccionado(s)?`)) {
      this.pushStateToUndoStack('Delete Items');
      const canvasData = this.canvas.getCurrentCanvas();
      const deletedCount = this.selectedItems.size;
      const itemIdsToDelete = Array.from(this.selectedItems);
      
      // Remove from data
      canvasData.items = canvasData.items.filter(item => !this.selectedItems.has(item.id));
      
      // Remove from DOM efficiently
      this.canvas.removeItemsFromDOM(itemIdsToDelete);
      
      this.selectedItems.clear();
      console.log(`🗑️  Successfully deleted ${deletedCount} items`);
      this.canvas.updateStatus(`${deletedCount} items eliminados`);
    } else {
      console.log('🗑️  Delete cancelled by user');
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
      console.log('↶ Undo: Nothing to undo');
      this.canvas.updateStatus('Nada que deshacer');
      return;
    }
    const lastState = this.undoStack.pop();
    const currentState = JSON.stringify(this.canvas.getCurrentCanvas());
    this.redoStack.push({ action: 'Redo ' + lastState.action, state: currentState });

    console.log(`↶ Undoing: ${lastState.action}`);
    this.restoreState(lastState.state);
    this.canvas.updateStatus(`Deshecho: ${lastState.action}`);
  }

  redo() {
    if (this.redoStack.length === 0) {
      console.log('↷ Redo: Nothing to redo');
      this.canvas.updateStatus('Nada que rehacer');
      return;
    }
    const nextState = this.redoStack.pop();
    const currentState = JSON.stringify(this.canvas.getCurrentCanvas());
    this.undoStack.push({ action: 'Undo ' + nextState.action, state: currentState });

    console.log(`↷ Redoing: ${nextState.action}`);
    this.restoreState(nextState.state);
    this.canvas.updateStatus(`Rehecho: ${nextState.action}`);
  }

  restoreState(stateString) {
    const state = JSON.parse(stateString);
    const currentCanvas = this.canvas.getCurrentCanvas();
    currentCanvas.items = state.items;
    currentCanvas.conjuntos = state.conjuntos;
    currentCanvas.transform = state.transform;
    
    // For undo/redo operations, we need a full re-render since the entire state changes
    // This is acceptable as undo/redo are less frequent operations
    this.canvas.render();
    
    // Clear current selection state after undo/redo
    this.selectedItems.clear();
  }

  // --- Additional functionality ---
  duplicateSelectedItems() {
    if (this.selectedItems.size === 0) {
      console.log('🔄 Duplicate: No items selected');
      return;
    }
    console.log(`🔄 Duplicating ${this.selectedItems.size} selected items`);
    this.copySelectedItems();
    this.pasteItems();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      console.log('🖥️  Entering fullscreen mode');
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`🖥️  Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      console.log('🖥️  Exiting fullscreen mode');
      document.exitFullscreen();
    }
  }
}
