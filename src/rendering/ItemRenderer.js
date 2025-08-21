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

    // Generate image content based on url_imagen validity
    const imageContent = this.getImageContent(item);

    div.innerHTML = `
                   <div class="item-image">${imageContent}</div>
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

  getImageContent(item) {
    // Check if url_imagen exists and is a valid URL
    if (item.url_imagen && this.isValidImageUrl(item.url_imagen)) {
      return `<img src="${item.url_imagen}" alt="${item.codigo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
              <div style="display: none; font-size: 24px;">${item.emoji || this.getEmojiForCategory(item.categoria)}</div>`;
    } else {
      // Fallback to emoji
      return item.emoji || this.getEmojiForCategory(item.categoria);
    }
  }

  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      // Check if it's a valid HTTP/HTTPS URL
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }
      
      // Check if it looks like an image URL (optional but helpful)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
      const pathname = urlObj.pathname.toLowerCase();
      const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
      
      // Accept URLs that either have image extensions or are from common image hosting services
      const commonImageHosts = ['imgur.com', 'cloudinary.com', 'amazonaws.com', 'googleusercontent.com', 'unsplash.com'];
      const hasImageHost = commonImageHosts.some(host => urlObj.hostname.includes(host));
      
      return hasImageExtension || hasImageHost || pathname.includes('image') || pathname.includes('img');
    } catch (e) {
      return false;
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