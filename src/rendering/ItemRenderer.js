// Item rendering and visualization
export class ItemRenderer {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
  }

  renderItem(item) {
    const div = document.createElement('div');
    div.className = 'item';
    div.dataset.itemId = item.id;
    div.style.left = item.x + 'px';
    div.style.top = item.y + 'px';
    div.style.borderLeftColor = item.color || '#dee2e6';

    const canvasData = this.canvas.getCurrentCanvas();
    const conjunto = canvasData.conjuntos.find(c => c.id === item.conjuntoId);
    const conjuntoName = conjunto ? conjunto.name : 'Unknown';

    div.innerHTML = `
                   <div class="item-image">${item.emoji || '📦'}</div>
                   <div class="item-code">${item.codigo}</div>
                   <div class="item-description" title="${item.descripcion}">${item.descripcion}</div>
                   <div class="item-talla">${item.talla}</div>
                   <div class="item-conjunto" style="font-size: 10px; color: #666; margin-top: 2px;">${conjuntoName}</div>
               `;

    const conjuntoElement = this.canvas.workspace.querySelector(`[data-conjunto-id="${item.conjuntoId}"]`);
    if (conjuntoElement) {
      conjuntoElement.appendChild(div);
    } else {
      this.canvas.workspace.appendChild(div);
    }
  }

  getEmojiForCategory(categoria) {
    const emojis = {
      'Camisetas': '👕',
      'Pantalones': '👖',
      'Vestidos': '👗',
      'Chaquetas': '🧥',
      'Zapatos': '👟',
      'Accesorios': '👜',
      'Sombreros': '🧢',
      'Ropa Interior': '🩲',
      'Deportiva': '🏃'
    };
    return emojis[categoria] || '📦';
  }
}