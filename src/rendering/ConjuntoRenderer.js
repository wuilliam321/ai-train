// Conjunto rendering and visualization
export class ConjuntoRenderer {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
  }

  renderConjunto(conjunto) {
    const div = document.createElement('div');
    div.className = 'conjunto';
    div.dataset.conjuntoId = conjunto.id;
    div.style.left = conjunto.x + 'px';
    div.style.top = conjunto.y + 'px';
    div.style.width = conjunto.width + 'px';
    div.style.height = conjunto.height + 'px';

    div.innerHTML = `
                   <div class="conjunto-header">
                       <input type="text" class="conjunto-title" value="${conjunto.name}" 
                              ${conjunto.id === 0 ? 'readonly' : ''} 
                              onchange="inventoryCanvas.updateConjuntoName(${conjunto.id}, this.value)">
                   </div>
                   ${conjunto.id !== 0 ? `<button class="conjunto-delete" onclick="inventoryCanvas.deleteConjunto(${conjunto.id})">&times;</button>` : ''}
                   <div class="resize-handle nw" data-corner="nw"></div>
                   <div class="resize-handle ne" data-corner="ne"></div>
                   <div class="resize-handle sw" data-corner="sw"></div>
                   <div class="resize-handle se" data-corner="se"></div>
               `;

    this.canvas.workspace.appendChild(div);
  }
}