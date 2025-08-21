// Global utility functions and backwards compatibility
export function setupGlobalFunctions(inventoryCanvas) {
  // Make inventoryCanvas globally available
  window.inventoryCanvas = inventoryCanvas;
  
  // Global functions for backwards compatibility
  window.importCSV = () => document.getElementById('csvFile').click();
  window.downloadTemplate = () => inventoryCanvas.fileHandler.downloadTemplate();
  window.createConjunto = () => inventoryCanvas.createConjunto();
  window.exportCanvas = () => inventoryCanvas.fileHandler.exportCanvas();
  window.importCanvas = () => document.getElementById('jsonFile').click();
  window.createNewCanvas = () => inventoryCanvas.canvasManager.createNewCanvas();
  window.createNewConjunto = () => {
    const name = document.getElementById('conjuntoName').value.trim();
    if (!name) {
      alert('Por favor ingrese un nombre para el conjunto');
      return;
    }
    inventoryCanvas.createConjunto(name);
    inventoryCanvas.closeModal('conjuntoModal');
    document.getElementById('conjuntoName').value = '';
  };
  window.createNewCanvasWithName = () => inventoryCanvas.canvasManager.createNewCanvasWithName();
  window.closeModal = (modalId) => inventoryCanvas.closeModal(modalId);
  window.zoomIn = () => inventoryCanvas.zoomIn();
  window.zoomOut = () => inventoryCanvas.zoomOut();
  window.resetZoom = () => inventoryCanvas.resetZoom();

  // Auto-save trigger function
  window.triggerAutoSave = () => {
    if (inventoryCanvas.autoSave) {
      inventoryCanvas.autoSave.triggerAutoSave();
    }
  };
}