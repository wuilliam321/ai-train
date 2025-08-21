// Contextual menu functionality
export class ContextMenu {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
    this.contextMenu = null;
    this.setupContextMenu();
  }

  setupContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      // Remover menú existente
      if (this.contextMenu) {
        document.body.removeChild(this.contextMenu);
      }

      const item = e.target.closest('.item');
      const conjunto = e.target.closest('.conjunto');

      if (item) {
        this.showItemContextMenu(e, item);
      } else if (conjunto) {
        this.showConjuntoContextMenu(e, conjunto);
      } else {
        this.showCanvasContextMenu(e);
      }
    });

    document.addEventListener('click', () => {
      if (this.contextMenu) {
        document.body.removeChild(this.contextMenu);
        this.contextMenu = null;
      }
    });
  }

  createContextMenu(items, x, y) {
    this.contextMenu = document.createElement('div');
    this.contextMenu.style.cssText = `
                   position: fixed;
                   background: white;
                   border: 1px solid #ccc;
                   border-radius: 6px;
                   box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                   z-index: 4000;
                   min-width: 150px;
                   left: ${x}px;
                   top: ${y}px;
               `;

    items.forEach((item, index) => {
      if (item === 'separator') {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: #eee; margin: 4px 0;';
        this.contextMenu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
                       padding: 8px 16px;
                       cursor: pointer;
                       font-size: 14px;
                       border-bottom: ${index < items.length - 1 ? '1px solid #f8f9fa' : 'none'};
                   `;
      menuItem.textContent = item.label;
      menuItem.addEventListener('mouseover', () => {
        menuItem.style.background = '#f8f9fa';
      });
      menuItem.addEventListener('mouseout', () => {
        menuItem.style.background = 'white';
      });
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        document.body.removeChild(this.contextMenu);
        this.contextMenu = null;
      });

      this.contextMenu.appendChild(menuItem);
    });

    document.body.appendChild(this.contextMenu);

    // Ajustar posición si se sale de la pantalla
    const rect = this.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = (y - rect.height) + 'px';
    }
  }

  showItemContextMenu(e, item) {
    const itemId = parseInt(item.dataset.itemId);
    const itemData = this.canvas.getCurrentCanvas().items.find(i => i.id === itemId);

    this.createContextMenu([
      {
        label: `📝 ${itemData.codigo}`,
        action: () => this.showNotification(`Código: ${itemData.codigo}\nDescripción: ${itemData.descripcion}\nTalla: ${itemData.talla}`)
      },
      'separator',
      {
        label: '📋 Duplicar',
        action: () => this.duplicateItem(itemId)
      },
      {
        label: '🔍 Seleccionar',
        action: () => {
          if (this.canvas.keyboardShortcuts) {
            this.canvas.keyboardShortcuts.selectedItems.clear();
            this.canvas.keyboardShortcuts.selectedItems.add(itemId);
            item.classList.add('selected');
            this.canvas.updateStatus('1 item seleccionado');
          }
        }
      },
      'separator',
      {
        label: '🗑️ Eliminar',
        action: () => {
          if (confirm(`¿Eliminar "${itemData.codigo}"?`)) {
            const canvas = this.canvas.getCurrentCanvas();
            canvas.items = canvas.items.filter(i => i.id !== itemId);
            this.canvas.render();
            this.showNotification('Item eliminado', 'success');
          }
        }
      }
    ], e.clientX, e.clientY);
  }

  showConjuntoContextMenu(e, conjunto) {
    const conjuntoId = parseInt(conjunto.dataset.conjuntoId);
    const conjuntoData = this.canvas.getCurrentCanvas().conjuntos.find(c => c.id === conjuntoId);

    const menuItems = [
      {
        label: `📦 ${conjuntoData.name}`,
        action: () => this.showNotification(`Conjunto: ${conjuntoData.name}\nItems: ${this.canvas.getCurrentCanvas().items.filter(i => i.conjuntoId === conjuntoId).length}`)
      },
      'separator',
      {
        label: '📋 Duplicar conjunto',
        action: () => this.duplicateConjunto(conjuntoId)
      },
      {
        label: '📐 Organizar en grilla',
        action: () => {
          const conjuntoItems = this.canvas.getCurrentCanvas().items.filter(i => i.conjuntoId === conjuntoId);
          const gridSize = 140;
          const itemsPerRow = Math.floor((conjuntoData.width - 40) / gridSize);

          conjuntoItems.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            item.x = 20 + (col * gridSize);
            item.y = 50 + (row * gridSize);
          });

          this.canvas.render();
          this.showNotification('Items organizados en grilla', 'success');
        }
      }
    ];

    if (conjuntoId !== 0) {
      menuItems.push('separator');
      menuItems.push({
        label: '🗑️ Eliminar conjunto',
        action: () => this.canvas.deleteConjunto(conjuntoId)
      });
    }

    this.createContextMenu(menuItems, e.clientX, e.clientY);
  }

  showCanvasContextMenu(e) {
    this.createContextMenu([
      {
        label: '➕ Nuevo conjunto',
        action: () => this.canvas.createConjunto()
      },
      {
        label: '📐 Organizar automáticamente',
        action: () => this.autoOrganizeItems()
      },
      {
        label: '🔍 Seleccionar todo',
        action: () => {
          if (this.canvas.keyboardShortcuts) {
            this.canvas.keyboardShortcuts.selectAllItems();
          }
        }
      },
      'separator',
      {
        label: '📊 Estadísticas',
        action: () => this.showCanvasStats()
      },
      {
        label: '🔄 Centrar vista',
        action: () => this.canvas.resetZoom()
      }
    ], e.clientX, e.clientY);
  }

  // Utility functions
  duplicateItem(itemId) {
    const canvas = this.canvas.getCurrentCanvas();
    const originalItem = canvas.items.find(i => i.id === itemId);

    if (originalItem) {
      const newItem = {
        ...originalItem,
        id: this.canvas.nextItemId++,
        codigo: originalItem.codigo + '_copy',
        x: originalItem.x + 20,
        y: originalItem.y + 20
      };

      canvas.items.push(newItem);
      this.canvas.render();
      this.canvas.updateStatus(`Item "${originalItem.codigo}" duplicado`);
      console.log(`✅ FASE 3: Item ${itemId} duplicado`);
    }
  }

  duplicateConjunto(conjuntoId) {
    const canvas = this.canvas.getCurrentCanvas();
    const originalConjunto = canvas.conjuntos.find(c => c.id === conjuntoId);

    if (originalConjunto && originalConjunto.id !== 0) {
      const newConjunto = {
        ...originalConjunto,
        id: this.canvas.nextConjuntoId++,
        name: originalConjunto.name + ' (Copia)',
        x: originalConjunto.x + 50,
        y: originalConjunto.y + 50
      };

      canvas.conjuntos.push(newConjunto);

      // Duplicar items del conjunto
      const conjuntoItems = canvas.items.filter(item => item.conjuntoId === conjuntoId);
      conjuntoItems.forEach(item => {
        const newItem = {
          ...item,
          id: this.canvas.nextItemId++,
          conjuntoId: newConjunto.id,
          codigo: item.codigo + '_copy',
          x: item.x + 10,
          y: item.y + 10
        };
        canvas.items.push(newItem);
      });

      this.canvas.render();
      this.canvas.updateStatus(`Conjunto "${originalConjunto.name}" duplicado con ${conjuntoItems.length} items`);
      console.log(`✅ FASE 3: Conjunto ${conjuntoId} duplicado`);
    }
  }

  autoOrganizeItems() {
    const canvas = this.canvas.getCurrentCanvas();

    if (confirm('¿Organizar items automáticamente por categoría?')) {
      // Crear conjuntos por categoría si no existen
      const categorias = [...new Set(canvas.items.map(i => i.categoria))].filter(Boolean);

      categorias.forEach(categoria => {
        let conjunto = canvas.conjuntos.find(c => c.name.toLowerCase() === categoria.toLowerCase());

        if (!conjunto) {
          conjunto = this.canvas.createConjunto(
            categoria,
            Math.random() * 600 + 100,
            Math.random() * 400 + 100
          );
        }

        // Mover items de esta categoría al conjunto
        canvas.items.forEach(item => {
          if (item.categoria === categoria) {
            item.conjuntoId = conjunto.id;
            item.x = Math.random() * 200 + 20;
            item.y = Math.random() * 100 + 50;
          }
        });
      });

      this.canvas.render();
      this.canvas.updateStatus(`Items organizados en ${categorias.length} conjuntos por categoría`);
      console.log(`✅ FASE 3: Auto-organización completada para ${categorias.length} categorías`);
    }
  }

  showCanvasStats() {
    const canvas = this.canvas.getCurrentCanvas();
    const stats = {
      items: canvas.items.length,
      conjuntos: canvas.conjuntos.length - 1, // -1 para excluir "Sin categorizar"
      categorias: [...new Set(canvas.items.map(i => i.categoria))].filter(Boolean).length,
      itemsPorConjunto: {}
    };

    canvas.conjuntos.forEach(conjunto => {
      const itemCount = canvas.items.filter(i => i.conjuntoId === conjunto.id).length;
      stats.itemsPorConjunto[conjunto.name] = itemCount;
    });

    let mensaje = `📊 ESTADÍSTICAS DEL CANVAS: ${canvas.name}\n\n`;
    mensaje += `• Items totales: ${stats.items}\n`;
    mensaje += `• Conjuntos: ${stats.conjuntos}\n`;
    mensaje += `• Categorías: ${stats.categorias}\n\n`;
    mensaje += `📦 ITEMS POR CONJUNTO:\n`;

    Object.entries(stats.itemsPorConjunto).forEach(([nombre, cantidad]) => {
      mensaje += `• ${nombre}: ${cantidad} items\n`;
    });

    alert(mensaje);
    console.log('📊 Estadísticas mostradas:', stats);
  }

  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
               position: fixed;
               top: 80px;
               right: 20px;
               background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
               color: white;
               padding: 12px 20px;
               border-radius: 6px;
               box-shadow: 0 4px 12px rgba(0,0,0,0.15);
               z-index: 3000;
               max-width: 300px;
               animation: slideIn 0.3s ease-out;
           `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  }
}