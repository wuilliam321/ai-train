// File import/export functionality
export class FileHandler {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.firstImport = true;
  }

  handleCSVUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.importItems(e.target.result);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  }

  importItems(csvData) {
    try {
      const lines = csvData.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('El archivo CSV debe tener al menos una cabecera y una fila de datos');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['codigo', 'categoria', 'descripcion', 'talla', 'url_imagen', 'color'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        throw new Error(`Headers faltantes: ${missingHeaders.join(', ')}`);
      }

      const canvasData = this.canvas.getCurrentCanvas();
      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length !== headers.length) continue;

        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index] || '';
        });

        if (canvasData.items.find(existing => existing.codigo === item.codigo)) {
          continue;
        }

        item.id = this.canvas.nextItemId++;
        item.conjuntoId = 0;
        item.x = Math.random() * 200 + 50;
        item.y = Math.random() * 120 + 80;
        item.emoji = this.canvas.itemRenderer.getEmojiForCategory(item.categoria);

        canvasData.items.push(item);
        importedCount++;
      }

      this.canvas.render();
      this.canvas.updateStatus(`${importedCount} items importados correctamente`);
      console.log(`✅ FASE 2: ${importedCount} items importados desde CSV`);

      if (this.firstImport && importedCount > 0) {
        this.autoOrganizeAfterImport();
        this.firstImport = false;
      }

    } catch (error) {
      alert(`Error al importar CSV: ${error.message}`);
      console.error('Error importando CSV:', error);
    }
  }

  autoOrganizeAfterImport() {
    const canvas = this.canvas.getCurrentCanvas();
    const categorias = [...new Set(canvas.items.map(i => i.categoria))].filter(Boolean);

    let lastConjuntoX = 50;
    let lastConjuntoY = 50;

    categorias.forEach(categoria => {
      let conjunto = canvas.conjuntos.find(c => c.name.toLowerCase() === categoria.toLowerCase());

      if (!conjunto) {
        conjunto = this.canvas.createConjunto(
          categoria,
          lastConjuntoX,
          lastConjuntoY
        );
        lastConjuntoX += conjunto.width + 50;
        if (lastConjuntoX > 2000) {
            lastConjuntoX = 50;
            lastConjuntoY += 700;
        }
      }

      const conjuntoItems = canvas.items.filter(item => item.categoria === categoria);
      conjuntoItems.forEach(item => item.conjuntoId = conjunto.id);

      const gridSizeX = 140;
      const gridSizeY = 280;
      const paddingX = 20;
      const paddingTop = 50;
      const paddingBottom = 20;

      const numItems = conjuntoItems.length;
      const cols = Math.ceil(Math.sqrt(numItems));
      const rows = Math.ceil(numItems / cols);

      const newWidth = (cols * gridSizeX) + (paddingX * 2);
      const newHeight = (rows * gridSizeY) + paddingTop + paddingBottom;

      conjunto.width = newWidth;
      conjunto.height = newHeight;

      conjuntoItems.forEach((item, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        item.x = paddingX + (col * gridSizeX);
        item.y = paddingTop + (row * gridSizeY);
      });
    });

    this.canvas.render();
    this.canvas.updateStatus('Items importados y organizados automáticamente');
    console.log('✅ Primera importación: Items organizados automáticamente');
  }

  downloadTemplate() {
    const template = `codigo,categoria,descripcion,talla,url_imagen,color
DEMO001,Camisetas,Camiseta básica blanca,M,https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=100&fit=crop,#ffffff
DEMO002,Pantalones,Jean clásico azul,32,https://images.unsplash.com/photo-1542272604-787c3835535d?w=100&h=100&fit=crop,#0066cc
DEMO003,Accesorios,Zapatillas deportivas,42,https://images.unsplash.com/photo-1549298916-b41d501d3772?w=100&h=100&fit=crop,#ff0000`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-inventario.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.canvas.updateStatus('Template CSV descargado');
    console.log('✅ FASE 2: Template CSV generado y descargado');
  }

  exportCanvas() {
    const data = {
      version: '1.1',
      timestamp: new Date().toISOString(),
      canvases: this.canvas.canvases,
      currentCanvas: this.canvas.currentCanvasIndex,
      metadata: {
        totalItems: this.canvas.canvases.reduce((sum, canvas) => sum + canvas.items.length, 0),
        totalConjuntos: this.canvas.canvases.reduce((sum, canvas) => sum + canvas.conjuntos.length, 0)
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const filename = `inventario-${new Date().toISOString().split('T')[0]}.json`;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.canvas.updateStatus(`Exportado: ${filename}`);
    console.log(`✅ FASE 2: Canvas exportado como ${filename}`);
  }

  handleJSONUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.importCanvasData(data);
        } catch (error) {
          alert('Error al leer el archivo JSON');
          console.error('Error importando JSON:', error);
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  }

  importCanvasData(data) {
    try {
      if (!data.version || !data.canvases) {
        throw new Error('Formato de archivo no válido');
      }

      data.canvases.forEach((canvas, index) => {
        if (!canvas.items || !canvas.conjuntos || !canvas.name) {
          throw new Error(`Canvas ${index + 1} tiene estructura inválida`);
        }
      });

      this.canvas.canvases = data.canvases;
      this.canvas.currentCanvasIndex = Math.min(data.currentCanvas || 0, this.canvas.canvases.length - 1);

      let maxItemId = 0;
      let maxConjuntoId = 0;

      this.canvas.canvases.forEach(canvas => {
        canvas.items.forEach(item => {
          maxItemId = Math.max(maxItemId, item.id || 0);
        });
        canvas.conjuntos.forEach(conjunto => {
          maxConjuntoId = Math.max(maxConjuntoId, conjunto.id || 0);
        });
      });

      this.canvas.nextItemId = maxItemId + 1;
      this.canvas.nextConjuntoId = maxConjuntoId + 1;

      this.canvas.render();
      this.canvas.canvasManager.updateCanvasTabs();

      const totalItems = data.metadata?.totalItems || 'desconocido';
      this.canvas.updateStatus(`Importado: ${totalItems} items en ${this.canvas.canvases.length} canvas`);
      console.log(`✅ FASE 2: Canvas importado correctamente`);

    } catch (error) {
      alert(`Error al importar: ${error.message}`);
      console.error('Error importando canvas:', error);
    }
  }
}