// Multi-canvas management
export class CanvasManager {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
  }

  createNewCanvas(name = null) {
    if (!name) {
      document.getElementById('canvasModal').style.display = 'flex';
      document.getElementById('canvasName').focus();
      return;
    }

    const newCanvas = {
      name: name.trim() || `Canvas ${this.canvas.canvases.length + 1}`,
      items: [],
      conjuntos: [{
        id: 0,
        name: 'Sin categorizar',
        x: 50,
        y: 50,
        width: 300,
        height: 200
      }],
      transform: { x: 0, y: 0, scale: 1 }
    };

    this.canvas.canvases.push(newCanvas);
    this.canvas.currentCanvasIndex = this.canvas.canvases.length - 1;
    this.canvas.render();
    this.updateCanvasTabs();

    this.canvas.updateStatus(`Canvas "${newCanvas.name}" creado`);
    console.log(`✅ FASE 2: Canvas "${newCanvas.name}" creado`);
  }

  createNewCanvasWithName() {
    const name = document.getElementById('canvasName').value.trim();
    if (!name) {
      alert('Por favor ingrese un nombre para el canvas');
      return;
    }

    this.createNewCanvas(name);
    this.canvas.closeModal('canvasModal');
    document.getElementById('canvasName').value = '';
  }

  switchToCanvas(index) {
    if (index >= 0 && index < this.canvas.canvases.length) {
      this.canvas.currentCanvasIndex = index;
      this.canvas.render();
      this.updateCanvasTabs();
      this.canvas.updateStatus(`Cambiado a: ${this.canvas.canvases[index].name}`);
      console.log(`Canvas cambiado a: ${this.canvas.canvases[index].name}`);
    }
  }

  closeCanvas(index) {
    if (this.canvas.canvases.length === 1) {
      alert('Debe mantener al menos un canvas');
      return;
    }

    const canvasName = this.canvas.canvases[index].name;
    if (confirm(`¿Cerrar canvas "${canvasName}"?`)) {
      this.canvas.canvases.splice(index, 1);

      if (this.canvas.currentCanvasIndex >= index) {
        this.canvas.currentCanvasIndex = Math.max(0, this.canvas.currentCanvasIndex - 1);
      }

      this.canvas.render();
      this.updateCanvasTabs();
      this.canvas.updateStatus(`Canvas "${canvasName}" cerrado`);
      console.log(`✅ Canvas "${canvasName}" cerrado`);
    }
  }

  updateCanvasTabs() {
    const tabsContainer = document.getElementById('canvasTabs');
    const tabsHTML = this.canvas.canvases.map((canvas, index) =>
      `<button class="canvas-tab ${index === this.canvas.currentCanvasIndex ? 'active' : ''}" 
                        onclick="inventoryCanvas.canvasManager.switchToCanvas(${index})">
                   ${canvas.name}
                   ${this.canvas.canvases.length > 1 ?
        `<span class="close-tab" onclick="event.stopPropagation(); inventoryCanvas.canvasManager.closeCanvas(${index})">&times;</span>` :
        ''}
                </button>`
    ).join('');

    tabsContainer.innerHTML = tabsHTML + '<button onclick="inventoryCanvas.canvasManager.createNewCanvas()">+ Nuevo</button>';
  }
}