// Keyboard shortcuts and hotkeys
export class KeyboardShortcuts {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.selectedItems = new Set();
  }

  setupAdvancedEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'KeyA':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.selectAllItems();
          }
          break;
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
        case 'Plus':
        case 'Equal':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.canvas.zoomIn();
          }
          break;
        case 'Minus':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.canvas.zoomOut();
          }
          break;
        case 'Digit0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.canvas.resetZoom();
          }
          break;
        case 'KeyS':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.canvas.fileHandler.exportCanvas();
          }
          break;
        case 'KeyO':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.getElementById('jsonFile').click();
          }
          break;
      }
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    document.getElementById('conjuntoName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // Use global function for compatibility
        if (window.createNewConjunto) {
          window.createNewConjunto();
        } else {
          // Fallback: create conjunto directly
          const name = document.getElementById('conjuntoName').value.trim();
          if (!name) {
            alert('Por favor ingrese un nombre para el conjunto');
            return;
          }
          this.canvas.createConjunto(name);
          this.canvas.closeModal('conjuntoModal');
          document.getElementById('conjuntoName').value = '';
        }
      }
    });

    document.getElementById('canvasName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // Use global function for compatibility
        if (window.createNewCanvasWithName) {
          window.createNewCanvasWithName();
        } else {
          // Fallback: create canvas directly
          this.canvas.canvasManager.createNewCanvasWithName();
        }
      }
    });

    console.log('✅ FASE 3: Event listeners avanzados configurados');
  }

  selectAllItems() {
    this.selectedItems.clear();
    const canvasData = this.canvas.getCurrentCanvas();

    document.querySelectorAll('.item').forEach(itemElement => {
      const itemId = parseInt(itemElement.dataset.itemId);
      if (canvasData.items.find(item => item.id === itemId && itemElement.style.display !== 'none')) {
        this.selectedItems.add(itemId);
        itemElement.classList.add('selected');
      }
    });

    this.canvas.updateStatus(`${this.selectedItems.size} items seleccionados`);
    console.log(`✅ FASE 3: ${this.selectedItems.size} items seleccionados`);
  }

  clearSelection() {
    this.selectedItems.clear();
    document.querySelectorAll('.item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    this.canvas.updateStatus('Selección limpiada');
  }

  deleteSelectedItems() {
    if (this.selectedItems.size === 0) {
      this.canvas.updateStatus('No hay items seleccionados');
      return;
    }

    if (confirm(`¿Eliminar ${this.selectedItems.size} item(s) seleccionado(s)?`)) {
      const canvasData = this.canvas.getCurrentCanvas();
      const deletedCount = this.selectedItems.size;

      canvasData.items = canvasData.items.filter(item => !this.selectedItems.has(item.id));
      this.selectedItems.clear();

      this.canvas.render();
      this.canvas.updateStatus(`${deletedCount} items eliminados`);
      console.log(`✅ FASE 3: ${deletedCount} items eliminados`);
    }
  }
}