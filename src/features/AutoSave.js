// Auto-save and session management
export class AutoSave {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.autoSaveTimeout = null;
  }

  triggerAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      if (this.canvas) {
        const data = {
          version: '1.1',
          timestamp: new Date().toISOString(),
          canvases: this.canvas.canvases,
          currentCanvas: this.canvas.currentCanvasIndex,
          autoSave: true
        };

        localStorage.setItem('inventoryCanvas_autosave', JSON.stringify(data));
        
        const currentCanvas = this.canvas.getCurrentCanvas();
        const sampleItem = currentCanvas.items.find(i => i.id === 10);
        if (sampleItem) {
          console.log(`💾 Auto-guardado realizado (debounced) - Item 10 position: x=${sampleItem.x}, y=${sampleItem.y}`);
        } else {
          console.log('💾 Auto-guardado realizado (debounced)');
        }
      }
    }, 500);
  }

  setupAutoSave() {
    setInterval(() => {
      if (this.canvas) {
        this.triggerAutoSave();
      }
    }, 300000);
  }

  loadAutoSave() {
    const autosave = localStorage.getItem('inventoryCanvas_autosave');
    if (autosave) {
      try {
        const data = JSON.parse(autosave);
        this.canvas.fileHandler.importCanvasData(data);
        this.canvas.updateStatus('Sesión guardada cargada automáticamente');
        console.log('✅ FASE 3: Auto-guardado cargado');
        return true;
      } catch (error) {
        console.error('Error cargando auto-guardado:', error);
        localStorage.removeItem('inventoryCanvas_autosave');
      }
    }
    return false;
  }
}