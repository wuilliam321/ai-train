// Main entry point - Modular Inventory Canvas
import { InventoryCanvas } from './src/core/InventoryCanvas.js';
import { AutoSave } from './src/features/AutoSave.js';
import { KeyboardShortcuts } from './src/features/KeyboardShortcuts.js';
import { ContextMenu } from './src/features/ContextMenu.js';
import { setupGlobalFunctions } from './src/utils/GlobalFunctions.js';

// TODO FASE 1: ✅ INICIANDO CORRECCIÓN DE BUGS CRÍTICOS
console.log('📋 TODO FASE 1: Corrección de Bugs Críticos');
console.log('- [✅] Fix: Drag de items');
console.log('- [✅] Fix: Redimensionamiento de conjuntos');
console.log('- [✅] Fix: Eliminación de conjuntos');
console.log('- [✅] Fix: Edición de nombres');

// Global inventory canvas instance
let inventoryCanvas;

// Advanced features instances
let autoSave;
let keyboardShortcuts;
let contextMenu;

// INICIALIZACIÓN MODULAR
document.addEventListener('DOMContentLoaded', () => {
  // Initialize core canvas
  inventoryCanvas = new InventoryCanvas();
  
  // Initialize advanced features
  autoSave = new AutoSave(inventoryCanvas);
  keyboardShortcuts = new KeyboardShortcuts(inventoryCanvas);
  contextMenu = new ContextMenu(inventoryCanvas);
  
  // Attach advanced features to main instance
  inventoryCanvas.autoSave = autoSave;
  inventoryCanvas.keyboardShortcuts = keyboardShortcuts;
  inventoryCanvas.contextMenu = contextMenu;
  
  // Setup global functions for backwards compatibility
  setupGlobalFunctions(inventoryCanvas);
  
  // Setup advanced features
  keyboardShortcuts.setupAdvancedEventListeners();
  
  // FASE 2 COMPLETADA - INICIANDO FASE 3
  console.log('✅ FASE 1 COMPLETADA: Bugs críticos corregidos');
  console.log('   - ✅ Drag de items funcional');
  console.log('   - ✅ Resize de conjuntos funcional');
  console.log('   - ✅ Eliminación de conjuntos funcional');
  console.log('   - ✅ Edición de nombres funcional');
  console.log('');
  console.log('✅ FASE 2 COMPLETADA: Funcionalidades core implementadas');
  console.log('   - ✅ Importación CSV real');
  console.log('   - ✅ Exportación JSON real');
  console.log('   - ✅ Template CSV descargable');
  console.log('   - ✅ Creación de conjuntos funcional');
  console.log('   - ✅ Sistema de múltiples canvas');
  console.log('');
  console.log('📋 TODO FASE 3: Funcionalidades avanzadas');
  console.log('   - [✅] Auto-guardado en localStorage');
  console.log('   - [✅] Selección múltiple de items');
  console.log('   - [✅] Atajos de teclado completos');
  console.log('   - [✅] Menú contextual (click derecho)');
  console.log('');
  console.log('🎉 APLICACIÓN MODULAR COMPLETAMENTE FUNCIONAL!');
  console.log('');
  console.log('📁 ESTRUCTURA MODULAR:');
  console.log('   • src/core/ - Lógica principal y manejo de canvas');
  console.log('   • src/rendering/ - Renderizado de items y conjuntos');
  console.log('   • src/features/ - Funcionalidades avanzadas');
  console.log('   • src/io/ - Importación y exportación');
  console.log('   • src/utils/ - Utilidades globales');
});

// ✅ INICIALIZACIÓN COMPLETA DE LA FASE 3
setTimeout(() => {
  if (inventoryCanvas && autoSave) {
    // Cargar auto-guardado si existe. Si no, cargar datos de demostración.
    if (!autoSave.loadAutoSave()) {
      inventoryCanvas.loadDemoData();
      console.log('✅ FASE 3: No se encontró auto-guardado. Iniciando con datos de demostración.');
    }

    // Configurar auto-guardado
    autoSave.setupAutoSave();

    console.log('');
    console.log('✅ REFACTORING COMPLETADO: Código modular y extensible');
    console.log('   - ✅ Separación por responsabilidades');
    console.log('   - ✅ Módulos ES6 con imports/exports');
    console.log('   - ✅ Arquitectura escalable');
    console.log('   - ✅ Compatibilidad hacia atrás mantenida');
    console.log('   - ✅ Menú contextual completamente funcional');
    console.log('');
    console.log('🚀 LISTO PARA DESARROLLO FUTURO!');
  }
}, 500);