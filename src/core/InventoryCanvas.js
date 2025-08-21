// Core canvas management and initialization
import { CanvasInteraction } from './CanvasInteraction.js';
import { ItemRenderer } from '../rendering/ItemRenderer.js';
import { ConjuntoRenderer } from '../rendering/ConjuntoRenderer.js';
import { SearchFilter } from '../features/SearchFilter.js';
import { FileHandler } from '../io/FileHandler.js';
import { CanvasManager } from './CanvasManager.js';

export class InventoryCanvas {
  constructor() {
    this.canvases = [{
      name: 'Canvas 1',
      items: this.getDemoItems(),
      conjuntos: this.getDemoConjuntos(),
      transform: { x: 0, y: 0, scale: 1 }
    }];

    this.currentCanvasIndex = 0;
    this.nextItemId = 11;
    this.nextConjuntoId = 4;

    // Initialize sub-modules
    this.interaction = new CanvasInteraction(this);
    this.itemRenderer = new ItemRenderer(this);
    this.conjuntoRenderer = new ConjuntoRenderer(this);
    this.searchFilter = new SearchFilter(this);
    this.fileHandler = new FileHandler(this);
    this.canvasManager = new CanvasManager(this);

    this.init();
  }

  getDemoItems() {
    return [
      { id: 1, codigo: "CAM001", categoria: "Camisetas", descripcion: "Camiseta básica blanca", talla: "M", color: "#ffffff", conjuntoId: 1, x: 20, y: 40, emoji: "👕" },
      { id: 2, codigo: "CAM002", categoria: "Camisetas", descripcion: "Polo deportivo azul", talla: "L", color: "#0066cc", conjuntoId: 1, x: 160, y: 40, emoji: "👔" },
      { id: 3, codigo: "CAM003", categoria: "Camisetas", descripcion: "Tank top negro", talla: "S", color: "#000000", conjuntoId: 1, x: 90, y: 140, emoji: "🎽" },
      { id: 4, codigo: "PAN001", categoria: "Pantalones", descripcion: "Jean clásico azul", talla: "32", color: "#004080", conjuntoId: 2, x: 20, y: 40, emoji: "👖" },
      { id: 5, codigo: "PAN002", categoria: "Pantalones", descripcion: "Short deportivo", talla: "M", color: "#333333", conjuntoId: 2, x: 160, y: 40, emoji: "🩳" },
      { id: 6, codigo: "ACC001", categoria: "Accesorios", descripcion: "Zapatillas deportivas", talla: "42", color: "#ff0000", conjuntoId: 3, x: 20, y: 40, emoji: "👟" },
      { id: 7, codigo: "ACC002", categoria: "Accesorios", descripcion: "Gorra snapback", talla: "U", color: "#00cc00", conjuntoId: 3, x: 160, y: 40, emoji: "🧢" },
      { id: 8, codigo: "ACC003", categoria: "Accesorios", descripcion: "Mochila urbana", talla: "U", color: "#800080", conjuntoId: 3, x: 300, y: 40, emoji: "👜" },
      { id: 9, codigo: "CHQ001", categoria: "Chaquetas", descripcion: "Chaqueta de cuero", talla: "L", color: "#8B4513", conjuntoId: 0, x: 100, y: 80, emoji: "🧥" },
      { id: 10, codigo: "VES001", categoria: "Vestidos", descripcion: "Vestido casual", talla: "M", color: "#FF69B4", conjuntoId: 0, x: 150, y: 120, emoji: "👗" }
    ];
  }

  getDemoConjuntos() {
    return [
      { id: 0, name: "Sin categorizar", x: 50, y: 50, width: 300, height: 200 },
      { id: 1, name: "Camisetas", x: 400, y: 50, width: 350, height: 250 },
      { id: 2, name: "Pantalones", x: 800, y: 50, width: 300, height: 200 },
      { id: 3, name: "Accesorios", x: 50, y: 300, width: 400, height: 180 }
    ];
  }

  init() {
    this.workspace = document.getElementById('workspace');
    this.container = document.getElementById('canvasContainer');

    this.interaction.setupEventListeners();
    this.render();
    this.updateStatus();

    console.log('✅ FASE 1 INICIADA: Bugs críticos identificados');
  }

  getCurrentCanvas() {
    return this.canvases[this.currentCanvasIndex];
  }

  render() {
    this.workspace.innerHTML = '';
    const canvas = this.getCurrentCanvas();

    canvas.conjuntos.forEach(conjunto => {
      this.conjuntoRenderer.renderConjunto(conjunto);
    });

    canvas.items.forEach(item => {
      this.itemRenderer.renderItem(item);
    });

    this.updateTransform();
    this.searchFilter.updateCategoryFilter();
    this.updateStatus();

    console.log('✅ Render completado');
  }

  updateTransform() {
    const canvas = this.getCurrentCanvas();
    const { x, y, scale } = canvas.transform;
    this.workspace.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  updateStatus(text = null) {
    const canvas = this.getCurrentCanvas();
    const items = canvas.items.length;
    const conjuntos = canvas.conjuntos.length;
    const zoom = Math.round(canvas.transform.scale * 100);

    if (text) {
      document.getElementById('statusText').textContent = text;
    }

    document.getElementById('progressText').textContent =
      `Items: ${items} | Conjuntos: ${conjuntos} | Zoom: ${zoom}%`;
  }

  updateConjuntoName(conjuntoId, newName) {
    const canvas = this.getCurrentCanvas();
    const conjunto = canvas.conjuntos.find(c => c.id === conjuntoId);
    if (conjunto && conjunto.id !== 0) {
      conjunto.name = newName.trim() || `Conjunto ${conjuntoId}`;
      this.updateStatus(`Conjunto renombrado: ${conjunto.name}`);
      console.log(`✅ FIX: Conjunto ${conjuntoId} renombrado a "${conjunto.name}"`);
    }
  }

  deleteConjunto(conjuntoId) {
    if (conjuntoId === 0) {
      this.updateStatus('No se puede eliminar "Sin categorizar"');
      return;
    }

    if (confirm('¿Eliminar este conjunto? Los items se moverán a "Sin categorizar".')) {
      const canvas = this.getCurrentCanvas();

      canvas.items.forEach(item => {
        if (item.conjuntoId === conjuntoId) {
          item.conjuntoId = 0;
          item.x = Math.random() * 200 + 20;
          item.y = Math.random() * 100 + 50;
        }
      });

      canvas.conjuntos = canvas.conjuntos.filter(c => c.id !== conjuntoId);

      this.render();
      this.updateStatus('Conjunto eliminado');
      console.log(`✅ FIX: Conjunto ${conjuntoId} eliminado correctamente`);
    }
  }

  createConjunto(name = null, x = null, y = null) {
    if (!name) {
      document.getElementById('conjuntoModal').style.display = 'flex';
      document.getElementById('conjuntoName').focus();
      return;
    }

    const canvas = this.getCurrentCanvas();
    const conjunto = {
      id: this.nextConjuntoId++,
      name: name.trim() || `Conjunto ${this.nextConjuntoId - 1}`,
      x: x || Math.random() * 500 + 200,
      y: y || Math.random() * 300 + 100,
      width: 300,
      height: 200
    };

    canvas.conjuntos.push(conjunto);
    this.render();
    this.updateStatus(`Conjunto "${conjunto.name}" creado`);
    console.log(`✅ FASE 2: Conjunto "${conjunto.name}" creado con ID ${conjunto.id}`);

    return conjunto;
  }

  // Zoom controls
  zoomIn() {
    const canvas = this.getCurrentCanvas();
    canvas.transform.scale = Math.min(5, canvas.transform.scale * 1.2);
    this.updateTransform();
    this.updateStatus();
  }

  zoomOut() {
    const canvas = this.getCurrentCanvas();
    canvas.transform.scale = Math.max(0.1, canvas.transform.scale / 1.2);
    this.updateTransform();
    this.updateStatus();
  }

  resetZoom() {
    const canvas = this.getCurrentCanvas();
    canvas.transform = { x: 0, y: 0, scale: 1 };
    this.updateTransform();
    this.updateStatus('Zoom restablecido');
  }

  closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
  }
}