// Search and filtering functionality
export class SearchFilter {
  constructor(inventoryCanvas) {
    this.canvas = inventoryCanvas;
  }

  handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    this.filterItems(searchTerm, category);
  }

  handleCategoryFilter(e) {
    const category = e.target.value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    this.filterItems(searchTerm, category);
  }

  filterItems(searchTerm = '', category = '') {
    const canvasData = this.canvas.getCurrentCanvas();
    let visibleCount = 0;

    document.querySelectorAll('.item').forEach(itemElement => {
      const itemId = parseInt(itemElement.dataset.itemId);
      const item = canvasData.items.find(i => i.id === itemId);

      if (!item) return;

      const matchesSearch = !searchTerm ||
        item.codigo.toLowerCase().includes(searchTerm) ||
        item.descripcion.toLowerCase().includes(searchTerm) ||
        item.talla.toLowerCase().includes(searchTerm);

      const matchesCategory = !category || item.categoria === category;
      const isVisible = matchesSearch && matchesCategory;

      itemElement.style.display = isVisible ? 'block' : 'none';
      if (isVisible) visibleCount++;
    });

    if (searchTerm || category) {
      this.canvas.updateStatus(`Mostrando ${visibleCount} items filtrados`);
    } else {
      this.canvas.updateStatus();
    }
  }

  updateCategoryFilter() {
    const canvasData = this.canvas.getCurrentCanvas();
    const categories = [...new Set(canvasData.items.map(item => item.categoria))].filter(Boolean).sort();
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;

    select.innerHTML = '<option value="">Todas las categorías</option>' +
      categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    if (categories.includes(currentValue)) {
      select.value = currentValue;
    }
  }
}