import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World, BLOCK } from './World';
import { ItemEntity } from './ItemEntity';
import { TOOL_DEFS, generateToolTexture, generateBlockIcon } from './ToolTextures';
import { BLOCK_DEFS } from './BlockTextures';
import type { GeneratedTexture } from './ToolTextures';
import { RECIPES } from './Recipes';
import type { Recipe } from './Recipes';
import { MobManager } from './MobManager';
import { PlayerHand } from './PlayerHand';
import './style.css';

// Tool Textures Registry
const TOOL_TEXTURES: Record<number, GeneratedTexture> = {};

function initToolTextures() {
    try {
        if (!BLOCK) {
            console.error("BLOCK is undefined! World module failed to load?");
            return;
        }
        
        console.log("Generating tool textures...");
        
        TOOL_TEXTURES[BLOCK.STICK] = generateToolTexture(TOOL_DEFS.STICK.pattern, TOOL_DEFS.STICK.color);
        
        TOOL_TEXTURES[BLOCK.WOODEN_SWORD] = generateToolTexture(TOOL_DEFS.WOODEN_SWORD.pattern, TOOL_DEFS.WOODEN_SWORD.color);
        TOOL_TEXTURES[BLOCK.STONE_SWORD] = generateToolTexture(TOOL_DEFS.STONE_SWORD.pattern, TOOL_DEFS.STONE_SWORD.color);
        
        TOOL_TEXTURES[BLOCK.WOODEN_PICKAXE] = generateToolTexture(TOOL_DEFS.WOODEN_PICKAXE.pattern, TOOL_DEFS.WOODEN_PICKAXE.color);
        TOOL_TEXTURES[BLOCK.STONE_PICKAXE] = generateToolTexture(TOOL_DEFS.STONE_PICKAXE.pattern, TOOL_DEFS.STONE_PICKAXE.color);
        
        TOOL_TEXTURES[BLOCK.WOODEN_AXE] = generateToolTexture(TOOL_DEFS.WOODEN_AXE.pattern, TOOL_DEFS.WOODEN_AXE.color);
        TOOL_TEXTURES[BLOCK.STONE_AXE] = generateToolTexture(TOOL_DEFS.STONE_AXE.pattern, TOOL_DEFS.STONE_AXE.color);

        TOOL_TEXTURES[BLOCK.WOODEN_SHOVEL] = generateToolTexture(TOOL_DEFS.WOODEN_SHOVEL.pattern, TOOL_DEFS.WOODEN_SHOVEL.color);
        TOOL_TEXTURES[BLOCK.STONE_SHOVEL] = generateToolTexture(TOOL_DEFS.STONE_SHOVEL.pattern, TOOL_DEFS.STONE_SHOVEL.color);
        
        // Generate Crafting Table Icon
        if (BLOCK_DEFS.CRAFTING_TABLE_TOP && BLOCK_DEFS.CRAFTING_TABLE_TOP.pattern && BLOCK_DEFS.CRAFTING_TABLE_TOP.colors) {
            TOOL_TEXTURES[BLOCK.CRAFTING_TABLE] = generateBlockIcon(
                BLOCK_DEFS.CRAFTING_TABLE_TOP.pattern, 
                BLOCK_DEFS.CRAFTING_TABLE_TOP.colors
            );
        }

        console.log("Tool textures generated.");
    } catch (e) {
        console.error("Failed to generate tool textures:", e);
    }
}

// Initialize later to ensure dependencies are ready
initToolTextures();

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
if (isMobile) {
  document.body.classList.add('is-mobile');
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

// UI Scene (for Hand)
const uiScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.set(8, 20, 20);
camera.lookAt(8, 8, 8);

const uiCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
uiScene.add(uiCamera);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile }); // Disable AA on mobile for perf
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio to prevent lag on high-DPI phones
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = !isMobile; // Disable shadows by default on mobile
renderer.autoClear = false; // Manual clearing for overlay
document.body.appendChild(renderer.domElement);

import { Environment } from './Environment';
import { initDebugControls } from './DebugUtils';

// Lights - Handled by Environment
const environment = new Environment(scene);
initDebugControls(environment);

// Controls
const controls = new PointerLockControls(camera, document.body);

controls.addEventListener('lock', () => {
  if (isInventoryOpen) toggleInventory(); // Close inventory if locking (e.g. clicking back in)
});

controls.addEventListener('unlock', () => {
  // If we unlocked and we are not in inventory or already paused (via menu) or in CLI, then auto-pause
  if (!isInventoryOpen && !isPaused && isGameStarted && !isCliOpen) {
    showPauseMenu();
  }
});

scene.add(controls.object);

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isOnGround = false;

const GRAVITY = 20.0;
const JUMP_HEIGHT = 1.25;
const JUMP_IMPULSE = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);

const velocity = new THREE.Vector3();

const onKeyDown = (event: KeyboardEvent) => {
  if (isCliOpen) return; // Ignore game keys when typing
  
  switch (event.code) {
    case 'Slash':
        event.preventDefault();
        toggleCLI(true, '/');
        break;
    case 'KeyT':
        if (!isPaused && isGameStarted && !isInventoryOpen) {
             event.preventDefault();
             toggleCLI(true, '');
        }
        break;
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (isOnGround) {
        velocity.y = JUMP_IMPULSE;
        isOnGround = false;
      }
      break;
    case 'KeyE':
      if (!isPaused) toggleInventory(false);
      break;
    case 'Escape':
      if (isInventoryOpen) toggleInventory();
      else togglePauseMenu();
      break;
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// World Generation
const world = new World(scene);
const entities: ItemEntity[] = [];
const mobManager = new MobManager(world, scene, entities);

// UI Lighting
const uiLight = new THREE.DirectionalLight(0xffffff, 1.5);
uiLight.position.set(1, 1, 1);
uiScene.add(uiLight);
const uiAmbient = new THREE.AmbientLight(0xffffff, 0.5);
uiScene.add(uiAmbient);

const playerHand = new PlayerHand(uiCamera, world.noiseTexture, TOOL_TEXTURES);

// Block Data
const BLOCK_NAMES: Record<number, string> = {
  1: 'Блок травы',
  2: 'Земля',
  3: 'Камень',
  4: 'Бедрок',
  5: 'Дерево',
  6: 'Листва',
  7: 'Доски',
  8: 'Палка',
  9: 'Верстак',
  20: 'Деревянный меч',
  21: 'Каменный меч',
  22: 'Деревянная кирка',
  23: 'Каменная кирка',
  24: 'Деревянный топор',
  25: 'Каменный топор',
  26: 'Деревянная лопата',
  27: 'Каменная лопата'
};

// Inventory State
const inventorySlots = Array.from({ length: 36 }, () => ({ id: 0, count: 0 }));
let selectedSlot = 0;
let isInventoryOpen = false;
let touchStartSlotIndex: number | null = null;

// Drag and Drop State
let draggedItem: { id: number, count: number } | null = null;
const dragIcon = document.getElementById('drag-icon')!;

// UI Elements
const hotbarContainer = document.getElementById('hotbar')!;
const inventoryMenu = document.getElementById('inventory-menu')!;
const inventoryGrid = document.getElementById('inventory-grid')!;
const tooltip = document.getElementById('tooltip')!;
const hotbarLabel = document.getElementById('hotbar-label')!;

let hotbarLabelTimeout: number;

// CLI Elements
let isCliOpen = false;
const cliContainer = document.createElement('div');
cliContainer.id = 'cli-container';
const cliInput = document.createElement('input');
cliInput.id = 'cli-input';
cliInput.type = 'text';
cliInput.autocomplete = 'off';
cliContainer.appendChild(cliInput);
document.body.appendChild(cliContainer);

// Disable context menu for right-click splitting
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

function toggleCLI(open: boolean, initialChar: string = '') {
    if (open) {
        if (!isGameStarted) return; // Don't open in menus
        isCliOpen = true;
        cliContainer.style.display = 'flex';
        cliInput.value = initialChar;
        cliInput.focus();
        controls.unlock();
        // Clear move flags to stop walking when typing
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    } else {
        isCliOpen = false;
        cliContainer.style.display = 'none';
        cliInput.value = '';
        cliInput.blur();
        if (!isInventoryOpen && !isPaused) controls.lock();
    }
}

function handleCommand(cmd: string) {
    if (!cmd.startsWith('/')) return;
    
    const parts = cmd.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (command === 'give') {
        if (args.length < 1) {
            console.log("Usage: /give <item> [amount]");
            showHotbarLabel("Usage: /give <item> [amount]");
            return;
        }

        const itemName = args[0].toLowerCase();
        const amount = parseInt(args[1]) || 1;
        
        // Find block ID by name
        let targetId = 0;
        // Simple search in BLOCK_NAMES (localized) or hardcoded map
        // Let's make a simple English mapping for CLI
        const ITEM_MAP: Record<string, number> = {
            'grass': 1,
            'dirt': 2,
            'stone': 3,
            'bedrock': 4,
            'wood': 5,
            'leaves': 6,
            'planks': 7,
            'stick': 8,
            'crafting_table': 9,
            'wooden_sword': 20,
            'stone_sword': 21,
            'wooden_pickaxe': 22,
            'stone_pickaxe': 23,
            'wooden_axe': 24,
            'stone_axe': 25,
            'wooden_shovel': 26,
            'stone_shovel': 27
        };

        if (ITEM_MAP[itemName]) {
            targetId = ITEM_MAP[itemName];
        } else {
            // Try to find in BLOCK_NAMES (reverse lookup?)
            // For now just numeric ID support too
            const numericId = parseInt(itemName);
            if (!isNaN(numericId) && BLOCK_NAMES[numericId]) {
                targetId = numericId;
            }
        }

        if (targetId !== 0) {
            // Add to inventory
            addItemToInventory(targetId, amount);
            showHotbarLabel(`Gave ${amount} ${BLOCK_NAMES[targetId]}`);
        } else {
            showHotbarLabel(`Unknown item: ${itemName}`);
        }
    }
}

function addItemToInventory(id: number, count: number) {
    // 1. Try to stack
    for(let i=0; i<36; i++) {
        if (inventorySlots[i].id === id) {
            inventorySlots[i].count += count;
            refreshInventoryUI();
            return;
        }
    }
    // 2. Empty slot
    for(let i=0; i<36; i++) {
        if (inventorySlots[i].id === 0) {
            inventorySlots[i].id = id;
            inventorySlots[i].count = count;
            refreshInventoryUI();
            return;
        }
    }
    showHotbarLabel("Inventory full!");
}

cliInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Stop game controls from triggering
    if (e.key === 'Enter') {
        const cmd = cliInput.value.trim();
        if (cmd) handleCommand(cmd);
        toggleCLI(false);
    } else if (e.key === 'Escape') {
        toggleCLI(false);
    }
});

// Generate CSS Noise
const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const ctx = canvas.getContext('2d')!;
for (let i = 0; i < 64 * 64; i++) {
  const x = i % 64;
  const y = Math.floor(i / 64);
  const v = Math.floor(Math.random() * 50 + 200); // Light noise
  ctx.fillStyle = `rgba(${v},${v},${v},0.5)`; // Semi-transparent
  ctx.fillRect(x, y, 1, 1);
}
document.body.style.setProperty('--noise-url', `url(${canvas.toDataURL()})`);

function getBlockColor(id: number) {
  if (id === 1) return '#559955';
  if (id === 2) return '#8B4513';
  if (id === 3) return '#808080';
  if (id === 5) return '#654321';
  if (id === 6) return '#228B22';
  if (id === 7) return '#C29A6B';
  if (id === 8) return '#654321';
  if (id === 9) return '#a05a2b'; // Crafting Table
  if (id >= 20) return 'transparent';
  return '#fff';
}

function showHotbarLabel(text: string) {
  hotbarLabel.innerText = text;
  hotbarLabel.style.opacity = '1';
  clearTimeout(hotbarLabelTimeout);
  hotbarLabelTimeout = setTimeout(() => {
    hotbarLabel.style.opacity = '0';
  }, 2000);
}

function initSlotElement(index: number, isHotbar: boolean) {
  const div = document.createElement('div');
  div.classList.add('slot');
  div.setAttribute('data-index', index.toString());
  
  const icon = document.createElement('div');
  icon.classList.add('block-icon');
  icon.style.display = 'none';
  div.appendChild(icon);

  const count = document.createElement('div');
  count.classList.add('slot-count');
  count.innerText = '';
  div.appendChild(count);

  div.addEventListener('mouseenter', () => {
    const slot = inventorySlots[index];
    if (isInventoryOpen && slot.id !== 0) {
      tooltip.innerText = BLOCK_NAMES[slot.id] || 'Блок';
      tooltip.style.display = 'block';
    }
  });
  
  div.addEventListener('mousemove', (e) => {
    if (isInventoryOpen) {
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY + 10) + 'px';
    }
  });

  div.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  div.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (isInventoryOpen) {
      handleSlotClick(index, e.button);
    }
  });
  
  div.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault(); 

    if (isInventoryOpen) {
      touchStartSlotIndex = index;
      handleSlotClick(index);
      
      const touch = e.changedTouches[0];
      if (draggedItem) {
          dragIcon.style.left = touch.clientX + 'px';
          dragIcon.style.top = touch.clientY + 'px';
      }
      
    } else if (isHotbar) {
      selectedSlot = index;
      onHotbarChange();
    }
  });

  return div;
}

function updateSlotVisuals(index: number) {
  const slot = inventorySlots[index];
  const elements = document.querySelectorAll(`.slot[data-index="${index}"]`);
  
  elements.forEach(el => {
      if (el.parentElement === hotbarContainer) {
          if (index === selectedSlot) el.classList.add('active');
          else el.classList.remove('active');
      }

      const icon = el.querySelector('.block-icon') as HTMLElement;
      const countEl = el.querySelector('.slot-count') as HTMLElement;

      if (slot.id !== 0 && slot.count > 0) {
        icon.style.display = 'block';
        icon.style.backgroundColor = getBlockColor(slot.id);
        
        // Remove special classes first
        icon.classList.remove('item-stick', 'item-planks', 'item-tool', 'tool-sword', 'tool-pickaxe', 'tool-axe', 'mat-wood', 'mat-stone');
        
        // Reset styles
        icon.style.backgroundImage = '';
        icon.style.backgroundColor = '';

        if (TOOL_TEXTURES[slot.id]) {
            icon.classList.add('item-tool'); // Keeps size/reset
            icon.style.backgroundImage = `url(${TOOL_TEXTURES[slot.id].dataUrl})`;
        } else if (slot.id === 7) { // Planks
             icon.classList.add('item-planks');
             icon.style.backgroundColor = getBlockColor(slot.id);
        } else if (slot.id === 9) { // Crafting Table
             icon.style.backgroundColor = getBlockColor(slot.id);
             // Could add special class for pattern
             icon.style.backgroundImage = 'var(--noise-url)';
        } else {
             icon.style.backgroundColor = getBlockColor(slot.id);
             icon.style.backgroundImage = 'var(--noise-url)'; // Restore noise for blocks
        }
        
        countEl.innerText = slot.count.toString();
      } else {
        icon.style.display = 'none';
        countEl.innerText = '';
      }
  });
}

// --- Crafting System ---
let isCraftingOpen = false;
let isCraftingTable = false; // 2x2 or 3x3
const craftingSlots = Array.from({ length: 9 }, () => ({ id: 0, count: 0 }));
const craftingResult = { id: 0, count: 0 };

const craftingArea = document.createElement('div');
craftingArea.id = 'crafting-area';
// Build Crafting UI structure
// [ Grid ] -> [ Result ]

const craftGridContainer = document.createElement('div');
craftGridContainer.id = 'crafting-grid-container';
craftingArea.appendChild(craftGridContainer);

const arrowDiv = document.createElement('div');
arrowDiv.className = 'crafting-arrow';
arrowDiv.innerText = '→';
craftingArea.appendChild(arrowDiv);

const resultContainer = document.createElement('div');
resultContainer.id = 'crafting-result-container';
const resultSlotDiv = document.createElement('div'); // Will be init via initSlotElement
// We need custom logic for result slot because it's not part of standard inventorySlots array
resultSlotDiv.classList.add('slot');
resultSlotDiv.id = 'slot-result';
const resultIcon = document.createElement('div');
resultIcon.className = 'block-icon';
resultIcon.style.display = 'none';
const resultCount = document.createElement('div');
resultCount.className = 'slot-count';
resultSlotDiv.appendChild(resultIcon);
resultSlotDiv.appendChild(resultCount);

resultSlotDiv.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    handleResultClick();
});
resultSlotDiv.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    handleResultClick();
});

resultContainer.appendChild(resultSlotDiv);
craftingArea.appendChild(resultContainer);

// Mobile List
const mobileCraftingList = document.createElement('div');
mobileCraftingList.id = 'mobile-crafting-list';

function initCraftingUI() {
    // Insert into menu
    inventoryMenu.insertBefore(craftingArea, inventoryGrid);
    if (isMobile) {
        document.body.appendChild(mobileCraftingList); // Append to body for absolute positioning
        
        // Prevent camera movement when scrolling list
        mobileCraftingList.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: false });
        
        mobileCraftingList.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: false });
    }
}

// Call once
initCraftingUI();

function updateCraftingGridSize() {
    craftGridContainer.innerHTML = '';
    const size = isCraftingTable ? 3 : 2;
    const total = size * size;

    if (isCraftingTable) {
        craftGridContainer.classList.add('grid-3x3');
    } else {
        craftGridContainer.classList.remove('grid-3x3');
    }

    for (let i = 0; i < total; i++) {
        // Map 2x2 indices to 0,1,3,4 of 9-slot array or just use 0-3? 
        // Let's use 0-8 linearly. 
        // For 2x2, we use indices 0,1,2,3 of craftingSlots.
        
        const div = document.createElement('div');
        div.classList.add('slot');
        div.setAttribute('data-craft-index', i.toString());
        
        const icon = document.createElement('div');
        icon.classList.add('block-icon');
        icon.style.display = 'none';
        div.appendChild(icon);

        const countEl = document.createElement('div');
        countEl.classList.add('slot-count');
        div.appendChild(countEl);

        // Events
        const handleCraftSlot = (btn: number = 0) => {
             handleCraftSlotClick(i, btn);
        };

        div.addEventListener('mousedown', (e) => { e.stopPropagation(); handleCraftSlot(e.button); });
        div.addEventListener('touchstart', (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); handleCraftSlot(); });

        craftGridContainer.appendChild(div);
    }
}

function updateCraftingVisuals() {
    if (isMobile) {
        updateMobileCraftingList();
        return; // Desktop grid hidden on mobile usually? Or user wants separate UI.
                // User said "mobile needs list", implying grid is bad.
                // We'll hide grid on mobile via CSS or JS.
    }

    const size = isCraftingTable ? 3 : 2;
    const total = size * size;
    
    // Update Grid
    const slots = craftGridContainer.children;
    for(let i=0; i<total; i++) {
        const slot = craftingSlots[i];
        const el = slots[i] as HTMLElement;
        const icon = el.querySelector('.block-icon') as HTMLElement;
        const countEl = el.querySelector('.slot-count') as HTMLElement;

        if (slot.id !== 0 && slot.count > 0) {
            icon.style.display = 'block';
            
            // Cleanup classes
            icon.classList.remove('item-stick', 'item-planks', 'item-tool');
            icon.style.backgroundImage = '';
            
            if (TOOL_TEXTURES[slot.id]) {
                icon.classList.add('item-tool');
                icon.style.backgroundImage = `url(${TOOL_TEXTURES[slot.id].dataUrl})`;
            } else if (slot.id === 7) {
                icon.classList.add('item-planks');
                icon.style.backgroundColor = getBlockColor(slot.id);
            } else if (slot.id === 9) {
                 icon.style.backgroundColor = getBlockColor(slot.id);
            } else {
                icon.style.backgroundColor = getBlockColor(slot.id);
                icon.style.backgroundImage = 'var(--noise-url)';
            }
            
            countEl.innerText = slot.count.toString();
        } else {
            icon.style.display = 'none';
            countEl.innerText = '';
        }
    }

    // Update Result
    if (craftingResult.id !== 0) {
        resultIcon.style.display = 'block';
        
        // Cleanup classes
        resultIcon.classList.remove('item-stick', 'item-planks', 'item-tool');
        resultIcon.style.backgroundImage = '';

        if (TOOL_TEXTURES[craftingResult.id]) {
            resultIcon.classList.add('item-tool');
            resultIcon.style.backgroundImage = `url(${TOOL_TEXTURES[craftingResult.id].dataUrl})`;
        } else if (craftingResult.id === 7) {
            resultIcon.classList.add('item-planks');
            resultIcon.style.backgroundColor = getBlockColor(craftingResult.id);
        } else if (craftingResult.id === 9) {
            resultIcon.style.backgroundColor = getBlockColor(craftingResult.id);
        } else {
            resultIcon.style.backgroundColor = getBlockColor(craftingResult.id);
            resultIcon.style.backgroundImage = 'var(--noise-url)';
        }

        resultCount.innerText = craftingResult.count.toString();
    } else {
        resultIcon.style.display = 'none';
        resultCount.innerText = '';
    }
}

function checkRecipes() {
    // Convert current grid to a standardized "shape"
    // 1. Find bounds
    const size = isCraftingTable ? 3 : 2;
    let minX = size, minY = size, maxX = -1, maxY = -1;
    
    // Check if empty
    let isEmpty = true;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            if (craftingSlots[index].id !== 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                isEmpty = false;
            }
        }
    }

    if (isEmpty) {
        craftingResult.id = 0;
        craftingResult.count = 0;
        updateCraftingVisuals();
        return;
    }

    // 2. Extract relative pattern
    const patternWidth = maxX - minX + 1;
    const patternHeight = maxY - minY + 1;
    
    // Match against recipes
    for (const recipe of RECIPES) {
        // A. Shapeless (Simple ingredient count check)
        if (recipe.ingredients) {
            // Check if grid has exactly these ingredients
            // Copy ingredients to temp map
            const needed = [...recipe.ingredients];
            let match = true;
            let usedCount = 0;
            
            // Count total items in grid
            let gridItemCount = 0;
            for(let i=0; i<size*size; i++) if (craftingSlots[i].id !== 0) gridItemCount++;

            // For each item in grid, try to find in needed list
            for (let i=0; i<size*size; i++) {
                const slot = craftingSlots[i];
                if (slot.id === 0) continue;
                
                const foundIdx = needed.findIndex(n => n.id === slot.id && n.count > 0); // Assuming 1 per slot for now? 
                // Recipe definition "ingredients" assumes 1 unit per slot usually
                // But my def has 'count'.
                // Standard MC shapeless: List of items required.
                
                if (foundIdx !== -1) {
                    needed.splice(foundIdx, 1);
                } else {
                    match = false;
                    break;
                }
            }
            
            if (match && needed.length === 0) {
                 craftingResult.id = recipe.result.id;
                 craftingResult.count = recipe.result.count;
                 updateCraftingVisuals();
                 return;
            }
        }
        
        // B. Shaped
        if (recipe.pattern && recipe.keys) {
            if (recipe.pattern[0].length !== patternWidth || recipe.pattern.length !== patternHeight) {
                continue; // Size mismatch
            }

            let match = true;
            for (let y = 0; y < patternHeight; y++) {
                for (let x = 0; x < patternWidth; x++) {
                    const rowStr = recipe.pattern[y];
                    const keyChar = rowStr[x];
                    const expectedId = keyChar === ' ' ? 0 : recipe.keys[keyChar];
                    
                    // Grid pos
                    const gx = minX + x;
                    const gy = minY + y;
                    const gIndex = gy * size + gx;
                    
                    if (craftingSlots[gIndex].id !== expectedId) {
                        match = false;
                        break;
                    }
                }
                if (!match) break;
            }

            if (match) {
                craftingResult.id = recipe.result.id;
                craftingResult.count = recipe.result.count;
                updateCraftingVisuals();
                return;
            }
        }
    }

    // No match
    craftingResult.id = 0;
    craftingResult.count = 0;
    updateCraftingVisuals();
}

function handleCraftSlotClick(index: number, button: number = 0) {
    const slot = craftingSlots[index];

    if (!draggedItem) {
        if (slot.id !== 0) {
            if (button === 2) {
                // Right Click: Split
                const half = Math.ceil(slot.count / 2);
                draggedItem = { id: slot.id, count: half };
                slot.count -= half;
                if (slot.count === 0) slot.id = 0;
            } else {
                // Pickup All
                draggedItem = { ...slot };
                slot.id = 0;
                slot.count = 0;
            }
            checkRecipes();
        }
    } else {
        if (slot.id === 0) {
            if (button === 2) {
                // Place One
                slot.id = draggedItem.id;
                slot.count = 1;
                draggedItem.count--;
                if (draggedItem.count === 0) draggedItem = null;
            } else {
                // Place All
                slot.id = draggedItem.id;
                slot.count = draggedItem.count;
                draggedItem = null;
            }
            checkRecipes();
        } else if (slot.id === draggedItem.id) {
            if (button === 2) {
                 // Add One
                 slot.count++;
                 draggedItem.count--;
                 if (draggedItem.count === 0) draggedItem = null;
            } else {
                 // Add All
                 slot.count += draggedItem.count;
                 draggedItem = null;
            }
            checkRecipes();
        } else {
            // Swap
            const temp = { ...slot };
            slot.id = draggedItem.id;
            slot.count = draggedItem.count;
            draggedItem = temp;
            checkRecipes();
        }
    }
    updateCraftingVisuals();
    updateDragIcon();
}

function handleResultClick() {
    if (craftingResult.id === 0) return;

    // Check if we can pick it up
    if (!draggedItem) {
        draggedItem = { ...craftingResult };
        consumeIngredients();
    } else if (draggedItem.id === craftingResult.id) {
        draggedItem.count += craftingResult.count;
        consumeIngredients();
    }
    
    updateDragIcon();
    // checkRecipes is called inside consumeIngredients
}

function consumeIngredients() {
    const size = isCraftingTable ? 3 : 2;
    for (let i = 0; i < size * size; i++) {
        if (craftingSlots[i].id !== 0) {
            craftingSlots[i].count--;
            if (craftingSlots[i].count <= 0) {
                craftingSlots[i].id = 0;
                craftingSlots[i].count = 0;
            }
        }
    }
    checkRecipes();
}


// Mobile Crafting Logic
function updateMobileCraftingList() {
    mobileCraftingList.innerHTML = '';
    
    // Find all recipes that can be crafted from INVENTORY
    // Just a simple "can craft" check?
    // User wants a LIST of available items. 
    // Showing all recipes is safer, highlighting avail ones.
    
    // For simplicity, let's just show all RECIPES.
    
    RECIPES.forEach((recipe, idx) => {
        // Filter logic for Mobile:
        // If NOT using crafting table (isCraftingTable == false), only allow 2x2 recipes.
        if (!isCraftingTable) {
            let needs3x3 = false;
            
            if (recipe.pattern) {
                if (recipe.pattern.length > 2 || recipe.pattern[0].length > 2) {
                    needs3x3 = true;
                }
            } else if (recipe.ingredients) {
                // Shapeless: > 4 items requires 3x3
                let totalIngredients = 0;
                recipe.ingredients.forEach(i => totalIngredients += i.count);
                if (totalIngredients > 4) needs3x3 = true;
            }
            
            if (needs3x3) return; // Skip this recipe
        }

        // Calculate max craftable
        // 1. Tally Inventory
        const invMap = new Map<number, number>();
        inventorySlots.forEach(s => {
            if (s.id !== 0) invMap.set(s.id, (invMap.get(s.id)||0) + s.count);
        });

        // 2. Tally Recipe Requirements
        const reqMap = new Map<number, number>();
        if (recipe.ingredients) {
            recipe.ingredients.forEach(i => reqMap.set(i.id, (reqMap.get(i.id)||0) + i.count));
        } else if (recipe.pattern && recipe.keys) {
             for(const row of recipe.pattern) {
                 for(const char of row) {
                     if (char !== ' ') {
                         const id = recipe.keys[char];
                         reqMap.set(id, (reqMap.get(id)||0) + 1);
                     }
                 }
             }
        }

        // 3. Check sufficiency
        let canCraft = true;
        let maxCrafts = 999;

        for(const [reqId, reqCount] of reqMap) {
            const has = invMap.get(reqId) || 0;
            if (has < reqCount) {
                canCraft = false;
                maxCrafts = 0;
                break;
            } else {
                maxCrafts = Math.min(maxCrafts, Math.floor(has / reqCount));
            }
        }

        if (!canCraft) return; // Hide uncraftable? Or show disabled. "List of available for craft" implies filter.

        const btn = document.createElement('div');
        btn.className = 'craft-btn';
        
        // Ingredients Container
        const ingContainer = document.createElement('div');
        ingContainer.className = 'craft-ingredients';
        
        // Render unique ingredients (simplified)
        let ingCount = 0;
        for(const [reqId, reqCount] of reqMap) {
            if (ingCount >= 3) break; // Limit to 3 icons to save space
            
            const ingIcon = document.createElement('div');
            ingIcon.className = 'block-icon';
            // Copy style logic... reusing helper would be better but inline for now
            if (TOOL_TEXTURES[reqId]) {
                ingIcon.classList.add('item-tool');
                ingIcon.style.backgroundImage = `url(${TOOL_TEXTURES[reqId].dataUrl})`;
            } else if (reqId === 7) {
                ingIcon.classList.add('item-planks');
                ingIcon.style.backgroundColor = getBlockColor(reqId);
            } else if (reqId === 9) {
                 ingIcon.style.backgroundColor = getBlockColor(reqId);
            } else {
                ingIcon.style.backgroundColor = getBlockColor(reqId);
                ingIcon.style.backgroundImage = 'var(--noise-url)';
            }
            ingContainer.appendChild(ingIcon);
            ingCount++;
        }
        btn.appendChild(ingContainer);

        // Arrow
        const arrow = document.createElement('div');
        arrow.className = 'craft-arrow';
        arrow.innerText = '→';
        btn.appendChild(arrow);

        // Result Icon
        const icon = document.createElement('div');
        icon.className = 'block-icon';
        const rId = recipe.result.id;
        
        if (TOOL_TEXTURES[rId]) {
            icon.classList.add('item-tool');
            icon.style.backgroundImage = `url(${TOOL_TEXTURES[rId].dataUrl})`;
        } else if (rId === 7) {
            icon.classList.add('item-planks');
            icon.style.backgroundColor = getBlockColor(rId);
        } else if (rId === 9) {
             icon.style.backgroundColor = getBlockColor(rId);
        } else {
            icon.style.backgroundColor = getBlockColor(rId);
            icon.style.backgroundImage = 'var(--noise-url)';
        }
        
        btn.appendChild(icon);
        
        // Count if > 1
        if (recipe.result.count > 1) {
            const countDiv = document.createElement('div');
            countDiv.className = 'slot-count';
            countDiv.innerText = recipe.result.count.toString();
            icon.appendChild(countDiv);
        }
        
        btn.onclick = () => {
             // Consume from inventory
             for(const [reqId, reqCount] of reqMap) {
                 let remaining = reqCount;
                 for(let i=0; i<36; i++) {
                     if (inventorySlots[i].id === reqId) {
                         const take = Math.min(remaining, inventorySlots[i].count);
                         inventorySlots[i].count -= take;
                         remaining -= take;
                         if (inventorySlots[i].count === 0) inventorySlots[i].id = 0;
                         if (remaining <= 0) break;
                     }
                 }
             }
             
             // Add result
             addItemToInventory(recipe.result.id, recipe.result.count);
             refreshInventoryUI(); // Updates list too
        };
        
        mobileCraftingList.appendChild(btn);
    });
}


function initInventoryUI() {
  hotbarContainer.innerHTML = '';
  inventoryGrid.innerHTML = '';

  // Add Close Button for Mobile
  if (!document.getElementById('btn-close-inv')) {
      const closeBtn = document.createElement('div');
      closeBtn.id = 'btn-close-inv';
      closeBtn.innerText = 'X';
      closeBtn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          toggleInventory();
      });
      closeBtn.addEventListener('click', (e) => { // Fallback
          toggleInventory();
      });
      inventoryMenu.appendChild(closeBtn);
  }

  // Hotbar Container (0-8)
  for (let i = 0; i < 9; i++) {
    hotbarContainer.appendChild(initSlotElement(i, true));
  }

  // Inventory Grid: Main (9-35)
  for (let i = 9; i < 36; i++) {
    inventoryGrid.appendChild(initSlotElement(i, false));
  }
  
  // Separator
  const separator = document.createElement('div');
  separator.className = 'slot-hotbar-separator';
  separator.style.gridColumn = '1 / -1';
  inventoryGrid.appendChild(separator);

  // Inventory Grid: Hotbar Copy (0-8)
  for (let i = 0; i < 9; i++) {
    inventoryGrid.appendChild(initSlotElement(i, false));
  }
}

function refreshInventoryUI() {
    for(let i=0; i<36; i++) {
        updateSlotVisuals(i);
    }
    // Update hand if active slot changed count or ID
    const slot = inventorySlots[selectedSlot];
    playerHand.updateItem(slot ? slot.id : 0);

    if (isInventoryOpen) updateCraftingVisuals();
}

function toggleInventory(useCraftingTable = false) {
  isInventoryOpen = !isInventoryOpen;
  
  if (isInventoryOpen) {
    controls.unlock();
    inventoryMenu.style.display = 'flex';
    
    // Set Mode
    isCraftingTable = useCraftingTable;
    craftingArea.style.display = isMobile ? 'none' : 'flex'; // Hide grid on mobile
    mobileCraftingList.style.display = isMobile ? 'flex' : 'none';
    
    // Mobile: Hide controls
    if (isMobile) {
        document.getElementById('mobile-ui')!.style.display = 'none';
        // But keep INV button visible? No, usually close with 'E' logic or back button. 
        // We need a close button on inventory menu for mobile.
        // Actually 'btn-inv' is part of mobile-ui. If we hide mobile-ui, we hide the button to close it.
        // Let's hide specific parts of mobile-ui.
        document.getElementById('joystick-zone')!.style.display = 'none';
        document.getElementById('mobile-actions')!.style.display = 'none';
        // We need a way to close inventory. 
        // Add a close button to inventory menu? 
        // Or keep btn-inv visible.
        // btn-inv is child of mobile-ui.
        // Let's just hide joystick and actions.
    }
    
    updateCraftingGridSize();
    
    // Clear crafting slots when opening/closing?
    // MC keeps items in crafting table but throws them out if you close 2x2.
    // Simplification: Return items to inventory on close.
    
    refreshInventoryUI();
    updateCraftingVisuals();
    
  } else {
    // Auto-save on close
    world.saveWorld({
        position: controls.object.position,
        inventory: inventorySlots
    });

    // Return crafting items to inventory
    const size = isCraftingTable ? 3 : 2; // Actually we might have switched modes, but assuming we close what we opened.
    // If we closed via 'E', it's possible we were in 3x3.
    // Just clear all 9 slots to be safe.
    for(let i=0; i<9; i++) {
        if (craftingSlots[i].id !== 0) {
            addItemToInventory(craftingSlots[i].id, craftingSlots[i].count);
            craftingSlots[i].id = 0;
            craftingSlots[i].count = 0;
        }
    }
    craftingResult.id = 0;
    craftingResult.count = 0;
    // We already updated visuals in toggle, but UI is hidden now.
    
    if (isMobile) {
        mobileCraftingList.style.display = 'none';
        const mobileUi = document.getElementById('mobile-ui');
        if (mobileUi) mobileUi.style.display = 'block';
        document.getElementById('joystick-zone')!.style.display = 'block';
        document.getElementById('mobile-actions')!.style.display = 'flex';
    }

    controls.lock();
    inventoryMenu.style.display = 'none';
    tooltip.style.display = 'none';  
    
    if (draggedItem) {
      for (let i = 0; i < 36; i++) {
        if (inventorySlots[i].id === 0) {
          inventorySlots[i] = draggedItem;
          break;
        } else if (inventorySlots[i].id === draggedItem.id) {
            inventorySlots[i].count += draggedItem.count;
            break;
        }
      }
      draggedItem = null;
      updateDragIcon();
    }
  }
}

function handleSlotClick(index: number, button: number = 0) {
  const slot = inventorySlots[index];

  if (!draggedItem) {
    if (slot.id !== 0) {
        if (button === 2) {
             // Right Click: Split
             const half = Math.ceil(slot.count / 2);
             draggedItem = { id: slot.id, count: half };
             slot.count -= half;
             if (slot.count === 0) slot.id = 0;
        } else {
             // Left Click: Pickup All
             draggedItem = { ...slot };
             slot.id = 0;
             slot.count = 0;
        }
    }
  } else {
    if (slot.id === 0) {
        if (button === 2) {
            // Right Click: Place One
            slot.id = draggedItem.id;
            slot.count = 1;
            draggedItem.count--;
            if (draggedItem.count === 0) draggedItem = null;
        } else {
             // Left Click: Place All
             slot.id = draggedItem.id;
             slot.count = draggedItem.count;
             draggedItem = null;
        }
    } else if (slot.id === draggedItem.id) {
        if (button === 2) {
            // Right Click: Add One
            slot.count++;
            draggedItem.count--;
            if (draggedItem.count === 0) draggedItem = null;
        } else {
             // Left Click: Add All
             slot.count += draggedItem.count;
             draggedItem = null;
        }
    } else {
      // Swap (Left Click usually, RMB might fail or swap too)
      const temp = { ...slot };
      slot.id = draggedItem.id;
      slot.count = draggedItem.count;
      draggedItem = temp;
    }
  }
  
  refreshInventoryUI();
  updateDragIcon();
}

function updateDragIcon() {
  dragIcon.innerHTML = '';
  if (draggedItem && draggedItem.id !== 0) {
    dragIcon.style.display = 'block';
    const icon = document.createElement('div');
    icon.className = 'block-icon';
    icon.style.width = '32px';
    icon.style.height = '32px';
    
    if (TOOL_TEXTURES[draggedItem.id]) {
        icon.classList.add('item-tool');
        icon.style.backgroundImage = `url(${TOOL_TEXTURES[draggedItem.id].dataUrl})`;
    } else if (draggedItem.id === 7) {
        icon.classList.add('item-planks');
        icon.style.backgroundColor = getBlockColor(draggedItem.id);
    } else if (draggedItem.id === 9) {
        icon.style.backgroundColor = getBlockColor(draggedItem.id);
    } else {
        icon.style.backgroundColor = getBlockColor(draggedItem.id);
    }
    
    const count = document.createElement('div');
    count.className = 'slot-count';
    count.style.fontSize = '12px';
    count.innerText = draggedItem.count.toString();
    
    icon.appendChild(count);
    dragIcon.appendChild(icon);
  } else {
    dragIcon.style.display = 'none';
  }
}

window.addEventListener('mousemove', (e) => {
  if (draggedItem) {
    dragIcon.style.left = e.clientX + 'px';
    dragIcon.style.top = e.clientY + 'px';
  }
});

window.addEventListener('touchmove', (e) => {
  if (draggedItem && isInventoryOpen) {
    const touch = e.changedTouches[0];
    dragIcon.style.left = touch.clientX + 'px';
    dragIcon.style.top = touch.clientY + 'px';
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (draggedItem && isInventoryOpen && touchStartSlotIndex !== null) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const slotEl = target?.closest('.slot');
    
    if (slotEl) {
      const targetIndex = parseInt(slotEl.getAttribute('data-index') || '-1');
      // If dropped on a valid slot (even the same one), handle it
      if (targetIndex !== -1) {
        handleSlotClick(targetIndex);
      }
    } else {
        // Dropped outside or invalid target - return to start slot
        handleSlotClick(touchStartSlotIndex);
    }
    
    touchStartSlotIndex = null;
  }
});

initInventoryUI();
refreshInventoryUI();

function onHotbarChange() {
  refreshInventoryUI();
  const slot = inventorySlots[selectedSlot];
  if (slot && slot.id !== 0) {
    showHotbarLabel(BLOCK_NAMES[slot.id] || 'Unknown Block');
    playerHand.updateItem(slot.id);
  } else {
    hotbarLabel.style.opacity = '0';
    playerHand.updateItem(0);
  }
}

window.addEventListener('wheel', (event) => {
  if (event.deltaY > 0) {
    selectedSlot = (selectedSlot + 1) % 9;
  } else {
    selectedSlot = (selectedSlot - 1 + 9) % 9;
  }
  onHotbarChange();
});

window.addEventListener('keydown', (event) => {
  const key = parseInt(event.key);
  if (key >= 1 && key <= 9) {
    selectedSlot = key - 1;
    onHotbarChange();
  }
});

// Interaction
const raycaster = new THREE.Raycaster();
const cursorGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
cursorMesh.visible = false;
scene.add(cursorMesh);

// --- Block Breaking System ---

// 1. Generate Crack Textures (Atlas)
// We'll create a 10-frame atlas on a canvas
const crackCanvas = document.createElement('canvas');
crackCanvas.width = 640; // 10 frames * 64px
crackCanvas.height = 64;
const crackCtx = crackCanvas.getContext('2d')!;

// Disable smoothing for pixelated look
crackCtx.imageSmoothingEnabled = false;

for (let i = 0; i < 10; i++) {
    const offsetX = i * 64;
    const centerX = 32;
    const centerY = 32;
    
    // Percent based on frame (0.1 to 1.0)
    const progress = (i + 1) / 10;
    const maxDist = 32 * 1.2; // Cover corners
    const currentDist = maxDist * progress;
    
    // Pixelate: Loop 4x4 pixel blocks (16x16 grid for 64x64 texture)
    const pixelSize = 4; 
    
    for (let x = 0; x < 64; x += pixelSize) {
        for (let y = 0; y < 64; y += pixelSize) {
            const dx = x + pixelSize/2 - centerX;
            const dy = y + pixelSize/2 - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Add some noise to the edge
            const noise = (Math.random() - 0.5) * 10;
            
            if (dist < currentDist + noise) {
                crackCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black
                crackCtx.fillRect(offsetX + x, y, pixelSize, pixelSize);
            }
        }
    }
}

const crackTexture = new THREE.CanvasTexture(crackCanvas);
crackTexture.magFilter = THREE.NearestFilter;
crackTexture.minFilter = THREE.NearestFilter;
// We need to show only 1/10th of the texture
crackTexture.repeat.set(0.1, 1);

const crackGeometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const crackMaterial = new THREE.MeshBasicMaterial({ 
    map: crackTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4 // Push towards camera significantly
});
const crackMesh = new THREE.Mesh(crackGeometry, crackMaterial);
crackMesh.visible = false;
crackMesh.renderOrder = 999; // Render last (on top of blocks)
scene.add(crackMesh);

// State
let isBreaking = false;
let isAttackPressed = false;
let breakStartTime = 0;
let currentBreakBlock = new THREE.Vector3();
let currentBreakId = 0;

function updateBreaking(time: number) {
    if (!isBreaking) {
        crackMesh.visible = false;
        return;
    }

    // Raycast to check if still looking at same block
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = raycaster.intersectObjects(scene.children).find(i => i.object !== cursorMesh && i.object !== crackMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);
    
    let lookingAtSame = false;
    if (hit && hit.distance < 6) {
        const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.1));
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        const z = Math.floor(p.z);
        
        if (x === currentBreakBlock.x && y === currentBreakBlock.y && z === currentBreakBlock.z) {
            lookingAtSame = true;
        }
    }

    if (!lookingAtSame) {
        // Stop breaking if looked away
        isBreaking = false;
        crackMesh.visible = false;
        return;
    }

    // Update Progress
    const toolId = inventorySlots[selectedSlot].id;
    const duration = world.getBreakTime(currentBreakId, toolId);
    const elapsed = time - breakStartTime;
    const progress = Math.min(elapsed / duration, 1.0);

    if (progress >= 1.0) {
        // Break it!
        const x = currentBreakBlock.x;
        const y = currentBreakBlock.y;
        const z = currentBreakBlock.z;
        
        // Drop Item
        if (currentBreakId !== 0) {
            let toolTexture = null;
            if (TOOL_TEXTURES[currentBreakId]) {
                 toolTexture = TOOL_TEXTURES[currentBreakId].texture;
            }
            entities.push(new ItemEntity(world, scene, x, y, z, currentBreakId, world.noiseTexture, toolTexture));
        }
        
        world.setBlock(x, y, z, 0); // AIR
        
        // Reset
        isBreaking = false;
        crackMesh.visible = false;
    } else {
        // Update Visuals
        crackMesh.visible = true;
        crackMesh.position.set(currentBreakBlock.x + 0.5, currentBreakBlock.y + 0.5, currentBreakBlock.z + 0.5);
        
        // Select frame 0-9
        const frame = Math.floor(progress * 9);
        crackTexture.offset.x = frame * 0.1;
    }
}

function startBreaking() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = raycaster.intersectObjects(scene.children).find(i => i.object !== cursorMesh && i.object !== crackMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

    if (hit && hit.distance < 6) {
        const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.01));
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        const z = Math.floor(p.z);
      
      const id = world.getBlock(x, y, z);
      if (id !== 0 && id !== 4) { // Not Air or Bedrock
          isBreaking = true;
          breakStartTime = performance.now();
          currentBreakBlock.set(x, y, z);
          currentBreakId = id;
      }
    }
}

// Player Health System
let playerHP = 20;
let isInvulnerable = false;
const damageOverlay = document.getElementById('damage-overlay')!;
const healthBar = document.getElementById('health-bar')!;

// Init Health Bar
for (let i = 0; i < 20; i++) {
  const div = document.createElement('div');
  div.className = 'hp-unit';
  healthBar.appendChild(div);
}

function updateHealthUI() {
  const units = healthBar.children;
  for (let i = 0; i < 20; i++) {
    const unit = units[i] as HTMLElement;
    if (i < playerHP) {
      unit.classList.remove('empty');
    } else {
      unit.classList.add('empty');
    }
  }
}

function takeDamage(amount: number) {
  if (isInvulnerable) return;

  playerHP -= amount;
  if (playerHP < 0) playerHP = 0;
  updateHealthUI();
  
  isInvulnerable = true;
  
  // Red Flash Effect
  damageOverlay.style.transition = 'none';
  damageOverlay.style.opacity = '0.3';
  
  // Camera Shake
  const originalPos = camera.position.clone();
  const shakeIntensity = 0.2;
  
  // Apply shake
  camera.position.x += (Math.random() - 0.5) * shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  camera.position.z += (Math.random() - 0.5) * shakeIntensity;
  
  // Verify valid position
  if (checkCollision(camera.position)) {
    camera.position.copy(originalPos);
  }
  
  // Restore
  requestAnimationFrame(() => {
     damageOverlay.style.transition = 'opacity 0.5s ease-out';
     damageOverlay.style.opacity = '0';
  });

  if (playerHP <= 0) {
    respawn();
  }

  setTimeout(() => {
    isInvulnerable = false;
  }, 500);
}

function respawn() {
  playerHP = 20;
  updateHealthUI();
  isInvulnerable = false;
  
  // Teleport to spawn
  controls.object.position.set(8, 40, 8);
  velocity.set(0, 0, 0);
  
  console.log("Respawned!");
}

// Combat Constants
const ATTACK_RANGE = 2.5;
const PUNCH_DAMAGE = 1;
const ATTACK_COOLDOWN = 500;
let lastPlayerAttackTime = 0;

function performAttack() {
     const now = Date.now();
     if (now - lastPlayerAttackTime < ATTACK_COOLDOWN) return;
     lastPlayerAttackTime = now;
     
     // Calculate Damage
     let damage = 1;
     const toolId = inventorySlots[selectedSlot].id;
     if (toolId === 20) damage = 4; // Wood Sword
     else if (toolId === 21) damage = 5; // Stone Sword
     else if (toolId === 24) damage = 3; // Wood Axe
     else if (toolId === 25) damage = 4; // Stone Axe
     else if (toolId === 22) damage = 2; // Wood Pick
     else if (toolId === 23) damage = 3; // Stone Pick
     else if (toolId === 26) damage = 1.5; // Wood Shovel
     else if (toolId === 27) damage = 2.5; // Stone Shovel

     raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
     const intersects = raycaster.intersectObjects(scene.children, true); // Recursive to hit mob parts
     
     for (const hit of intersects) {
         if (hit.distance > ATTACK_RANGE) break;

         // Check if it's a mob or part of a mob
         let obj: THREE.Object3D | null = hit.object;
         let isMob = false;
         while(obj) {
             if (obj.userData && obj.userData.mob) {
                 isMob = true;
                 break;
             }
             obj = obj.parent;
         }

         if (isMob && obj) {
             obj.userData.mob.takeDamage(damage, controls.object.position);
             return; // Hit first mob and stop
         }

         // If we hit something else (like a block) that isn't ignored
         if (hit.object !== cursorMesh && hit.object !== crackMesh && hit.object !== controls.object && (hit.object as any).isMesh && !(hit.object as any).isItem) {
             // We hit a wall/block before any mob
             return;
         }
     }
}

function performInteract() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children);
  const hit = intersects.find(i => i.object !== cursorMesh && i.object !== crackMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

  if (hit && hit.distance < 6) {
      const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.01));
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      const z = Math.floor(p.z);

      const targetId = world.getBlock(x, y, z);
      if (targetId === BLOCK.CRAFTING_TABLE) {
          toggleInventory(true); // Open 3x3
          return;
      }

      // Place Block
      const slot = inventorySlots[selectedSlot];
      if (slot.id !== 0 && slot.count > 0) {
        // Prevent placing non-blocks (e.g. Stick)
        if (slot.id === BLOCK.STICK) return;

        if (hit.face) {
          const p = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.01));
          const x = Math.floor(p.x);
          const y = Math.floor(p.y);
          const z = Math.floor(p.z);
          
          // Check collision with player
          const playerMinX = controls.object.position.x - playerHalfWidth;
          const playerMaxX = controls.object.position.x + playerHalfWidth;
          const playerMinY = controls.object.position.y - eyeHeight;
          const playerMaxY = controls.object.position.y - eyeHeight + playerHeight;
          const playerMinZ = controls.object.position.z - playerHalfWidth;
          const playerMaxZ = controls.object.position.z + playerHalfWidth;

          const blockMinX = x;
          const blockMaxX = x + 1;
          const blockMinY = y;
          const blockMaxY = y + 1;
          const blockMinZ = z;
          const blockMaxZ = z + 1;

          if (
            playerMinX < blockMaxX &&
            playerMaxX > blockMinX &&
            playerMinY < blockMaxY &&
            playerMaxY > blockMinY &&
            playerMinZ < blockMaxZ &&
            playerMaxZ > blockMinZ
          ) {
            // Cannot place block inside player
            return;
          }

          world.setBlock(x, y, z, slot.id);
          
          // Decrement Inventory
          slot.count--;
          if (slot.count <= 0) {
            slot.id = 0;
            slot.count = 0;
          }
          refreshInventoryUI();
        }
      }
  }
}

document.addEventListener('mousedown', (event) => {
  if (isPaused || !isGameStarted) return;
  if (!controls.isLocked && !isMobile) return;
  if (isInventoryOpen) return;
  
  if (event.button === 0) {
      isAttackPressed = true;
      playerHand.punch();
      performAttack(); // Hit mobs
      startBreaking(); // Start mining block
  }
  else if (event.button === 2) performInteract();
});

document.addEventListener('mouseup', () => {
   if (isAttackPressed) isAttackPressed = false;
   playerHand.stopPunch();
   isBreaking = false;
   crackMesh.visible = false;
});

const playerHalfWidth = 0.3;
const playerHeight = 1.8;
const eyeHeight = 1.6;

function checkCollision(position: THREE.Vector3): boolean {
  const minX = Math.floor(position.x - playerHalfWidth);
  const maxX = Math.floor(position.x + playerHalfWidth);
  const minY = Math.floor(position.y - eyeHeight);
  const maxY = Math.floor(position.y - eyeHeight + playerHeight);
  const minZ = Math.floor(position.z - playerHalfWidth);
  const maxZ = Math.floor(position.z + playerHalfWidth);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.hasBlock(x, y, z)) {
          // Precise AABB check
          // Block AABB (blocks are centered at integer coordinates)
          const blockMinX = x;
          const blockMaxX = x + 1;
          const blockMinY = y;
          const blockMaxY = y + 1;
          const blockMinZ = z;
          const blockMaxZ = z + 1;

          // Player AABB
          const playerMinX = position.x - playerHalfWidth;
          const playerMaxX = position.x + playerHalfWidth;
          const playerMinY = position.y - eyeHeight;
          const playerMaxY = position.y - eyeHeight + playerHeight;
          const playerMinZ = position.z - playerHalfWidth;
          const playerMaxZ = position.z + playerHalfWidth;

          if (
            playerMinX < blockMaxX &&
            playerMaxX > blockMinX &&
            playerMinY < blockMaxY &&
            playerMaxY > blockMinY &&
            playerMinZ < blockMaxZ &&
            playerMaxZ > blockMinZ
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Animation Loop
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  if (isPaused) {
      renderer.render(scene, camera);
      return;
  }

  world.update(controls.object.position);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  environment.update(delta, controls.object.position);
  
  // Player Hand Update
  const isMoving = (moveForward || moveBackward || moveLeft || moveRight) && isOnGround;
  playerHand.update(delta, isMoving);

  updateBreaking(time);
  
  if (isAttackPressed && !isPaused && isGameStarted) {
      if (!isBreaking) startBreaking();
      performAttack();
  }

  // Update Entities & Pickup
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    entity.update(time / 1000, delta);

    if (entity.isDead) {
      entities.splice(i, 1);
      continue;
    }

    if (entity.mesh.position.distanceTo(controls.object.position) < 2.5) {
      // Pickup logic
      const type = entity.type;
      
      // 1. Try to find existing slot with same type
      let targetSlot = inventorySlots.find(s => s.id === type);
      
      // 2. If not found, find first empty slot
      if (!targetSlot) {
        targetSlot = inventorySlots.find(s => s.id === 0);
        if (targetSlot) {
            targetSlot.id = type;
            targetSlot.count = 0;
        }
      }

      // 3. Add to slot if found
      if (targetSlot) {
        targetSlot.count++;
        entity.dispose();
        entities.splice(i, 1);
        
        // Update Hotbar label if picking up to active slot
        if (targetSlot === inventorySlots[selectedSlot]) {
            onHotbarChange();
        } else {
            refreshInventoryUI();
        }
      }
    }
  }

  // Update Mob Manager
  mobManager.update(delta, controls.object.position, environment, takeDamage);

  // Cursor Update
  if (!isPaused && isGameStarted) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children);
    const hit = intersects.find(i => i.object !== cursorMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

    if (hit && hit.distance < 6) {
        const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.01));
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        const z = Math.floor(p.z);
      
      const id = world.getBlock(x, y, z);
      
      if (id !== 0) {
          cursorMesh.visible = true;
          cursorMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      } else {
          cursorMesh.visible = false;
      }
    } else {
      cursorMesh.visible = false;
    }
  }
  
  if (!isPaused && isGameStarted) {
    // Safety: Don't apply physics if the current chunk isn't loaded yet
    // This prevents falling through the world upon load/teleport
    if (!world.isChunkLoaded(controls.object.position.x, controls.object.position.z)) {
         // Still update entities/mobs even if player is frozen, but skip player physics
         // Actually, if we return here, we skip player movement code below.
         // We rely on the global world.update() at start of animate() to keep loading chunks.
        prevTime = time;
        return; 
    }

    // Input Vector (Local)
    const inputX = Number(moveRight) - Number(moveLeft);
    const inputZ = Number(moveForward) - Number(moveBackward);

    // Get Camera Direction (World projected to flat plane)
    const forward = new THREE.Vector3();
    controls.getDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Wish Direction (World)
    const moveDir = new THREE.Vector3()
        .addScaledVector(forward, inputZ)
        .addScaledVector(right, inputX);
    
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // Acceleration & Friction
    const speed = 50.0; // Acceleration force
    const friction = 10.0; // Friction factor
    const safeDelta = Math.min(delta, 0.05);

    if (moveForward || moveBackward || moveLeft || moveRight) {
        velocity.x += moveDir.x * speed * safeDelta;
        velocity.z += moveDir.z * speed * safeDelta;
    }

    const damping = Math.exp(-friction * safeDelta);
    velocity.x *= damping;
    velocity.z *= damping;
    velocity.y -= GRAVITY * safeDelta;

    // Apply & Collide X
    controls.object.position.x += velocity.x * safeDelta;
    if (checkCollision(controls.object.position)) {
        controls.object.position.x -= velocity.x * safeDelta;
        velocity.x = 0;
    }

    // Apply & Collide Z
    controls.object.position.z += velocity.z * safeDelta;
    if (checkCollision(controls.object.position)) {
        controls.object.position.z -= velocity.z * safeDelta;
        velocity.z = 0;
    }

    // Apply & Collide Y
    controls.object.position.y += velocity.y * safeDelta;
    
    // Assume we are in air until we hit ground
    isOnGround = false;

    if (checkCollision(controls.object.position)) {
      // Collision detected on Y axis
      if (velocity.y < 0) {
        // Falling, hit ground
        isOnGround = true;
        controls.object.position.y -= velocity.y * safeDelta;
        velocity.y = 0;
      } else {
        // Jumping, hit ceiling
        controls.object.position.y -= velocity.y * safeDelta;
        velocity.y = 0;
      }
    }
    
    // Fallback for falling out of world
    if (controls.object.position.y < -50) {
        controls.object.position.set(8, 40, 20);
        velocity.set(0, 0, 0);
    }
  }

  prevTime = time;

  renderer.clear(); // Clear color & depth
  renderer.render(scene, camera);
  renderer.clearDepth(); // Clear depth for UI overlay
  renderer.render(uiScene, uiCamera);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  uiCamera.aspect = window.innerWidth / window.innerHeight;
  uiCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mobile Controls Implementation

if (isMobile) {

  // Joystick Logic

  const joystickZone = document.getElementById('joystick-zone')!;

  const joystickStick = document.getElementById('joystick-stick')!;

  

  let stickStartX = 0;

  let stickStartY = 0;

  let isDraggingStick = false;

  let joystickTouchId: number | null = null;

  

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isDraggingStick) return;

    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    
    // Floating Joystick: Center is where we first touch
    stickStartX = touch.clientX;
    stickStartY = touch.clientY;
    
    // Move stick visual to finger immediately
    joystickStick.style.transition = 'none';
    joystickStick.style.transform = `translate(-50%, -50%)`; // Reset to center of container? No.
    // Actually, we usually want the stick to appear under the finger.
    // But the HTML layout has a fixed zone.
    // Let's keep the zone fixed but the "center" of logic is the start point.
    // Visual feedback: Move the stick relative to its neutral position?
    // Current CSS likely centers the stick in the zone.
    // Let's keep the stick visual centered in the zone initially, but move it relative to drag.
    
    // BETTER APPROACH for "Floating":
    // The visual stick starts at the center of the ZONE.
    // But logically, movement is relative to touch start.
    // To make it intuitive, we should probably snap the visual stick to the touch start? 
    // Or just treat the touch start as (0,0).
    
    isDraggingStick = true;
  });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDraggingStick || joystickTouchId === null) return;
    
    // Find the specific touch for the joystick
    let touch: Touch | undefined;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
            touch = e.changedTouches[i];
            break;
        }
    }
    
    if (!touch) return; 
    
    const dx = touch.clientX - stickStartX;
    const dy = touch.clientY - stickStartY;
    
    // Clamp stick visual
    const maxDist = 40;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const clampedDist = Math.min(distance, maxDist);
    const angle = Math.atan2(dy, dx);
    
    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;
    
    // Update visual: The stick moves from its CSS center
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    
    // Update movement flags
    // Fix inversion: dy is negative when moving UP (forward)
    // moveForward should be true if dy is negative
    const threshold = 10;
    moveForward = dy < -threshold;
    moveBackward = dy > threshold;
    moveLeft = dx < -threshold;
    moveRight = dx > threshold;
  });



  const resetStick = (e: TouchEvent) => {

    if (!isDraggingStick || joystickTouchId === null) return;



    // Check if the ending touch is the joystick touch

    let touchFound = false;

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === joystickTouchId) {

            touchFound = true;

            break;

        }

    }



    if (touchFound) {

        isDraggingStick = false;

        joystickTouchId = null;

        joystickStick.style.transform = `translate(-50%, -50%)`;

        moveForward = false;

        moveBackward = false;

        moveLeft = false;

        moveRight = false;

    }

  };



  joystickZone.addEventListener('touchend', resetStick);

  joystickZone.addEventListener('touchcancel', resetStick);



  // Buttons

  document.getElementById('btn-jump')!.addEventListener('touchstart', (e) => {

    e.preventDefault();

    if (isOnGround) {

        velocity.y = JUMP_IMPULSE;

        isOnGround = false;

    }

  });



    const btnAttack = document.getElementById('btn-attack')!;
    let attackTouchId: number | null = null;
    let lastAttackX = 0;
    let lastAttackY = 0;

    btnAttack.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (attackTouchId !== null) return;

        const touch = e.changedTouches[0];
        attackTouchId = touch.identifier;
        lastAttackX = touch.clientX;
        lastAttackY = touch.clientY;

        isAttackPressed = true;
        playerHand.punch();
        performAttack();
        startBreaking();
    });

    btnAttack.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (attackTouchId === null) return;

        let touch: Touch | undefined;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === attackTouchId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const dx = touch.clientX - lastAttackX;
        const dy = touch.clientY - lastAttackY;
        
        lastAttackX = touch.clientX;
        lastAttackY = touch.clientY;

        const SENSITIVITY = 0.005;
        controls.object.rotation.y -= dx * SENSITIVITY;
        camera.rotation.x -= dy * SENSITIVITY;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    });

    const endAttack = (e: TouchEvent) => {
        e.preventDefault();
        if (attackTouchId === null) return;
        
        let touchFound = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
             if (e.changedTouches[i].identifier === attackTouchId) {
                 touchFound = true;
                 break;
             }
        }

        if (touchFound) {
            isAttackPressed = false;
            playerHand.stopPunch();
            isBreaking = false;
            crackMesh.visible = false;
            attackTouchId = null;
        }
    };

    btnAttack.addEventListener('touchend', endAttack);
    btnAttack.addEventListener('touchcancel', endAttack);



  



  



  



    document.getElementById('btn-place')!.addEventListener('touchstart', (e) => {

    e.preventDefault();

    performInteract();

  });

  

  document.getElementById('btn-inv')!.addEventListener('touchstart', (e) => {

      e.preventDefault();

      toggleInventory(false);

  });



  // Camera Look (Touch Drag on background)

  let lastLookX = 0;

  let lastLookY = 0;

  let lookTouchId: number | null = null;

  

  document.addEventListener('touchstart', (e) => {

    if (lookTouchId !== null) return; // Already looking with a finger



    const target = e.target as HTMLElement;

    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar') || target.closest('#btn-inv')) return;

    

    const touch = e.changedTouches[0];

    lookTouchId = touch.identifier;

    lastLookX = touch.clientX;

    lastLookY = touch.clientY;

  });



    document.addEventListener('touchmove', (e) => {



      if (lookTouchId === null) return;



      if (e.cancelable) e.preventDefault();



      



       const target = e.target as HTMLElement;

    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar') || target.closest('#btn-inv')) return;



    // Find the look touch

    let touch: Touch | undefined;

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === lookTouchId) {

            touch = e.changedTouches[i];

            break;

        }

    }

    

    if (!touch) return;



    const dx = touch.clientX - lastLookX;

    const dy = touch.clientY - lastLookY;

    

    lastLookX = touch.clientX;

    lastLookY = touch.clientY;

    

    // Sensitivity

    const SENSITIVITY = 0.005;

    

    controls.object.rotation.y -= dx * SENSITIVITY;

    camera.rotation.x -= dy * SENSITIVITY;

    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

  }, { passive: false });



  const endLook = (e: TouchEvent) => {

    if (lookTouchId === null) return;

    

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === lookTouchId) {

            lookTouchId = null;

            break;

        }

    }

  };



  document.addEventListener('touchend', endLook);

  document.addEventListener('touchcancel', endLook);



  // Mobile Menu Button

  document.getElementById('btn-menu')!.addEventListener('touchstart', (e) => {

      e.preventDefault();

      togglePauseMenu();

  });

}



// --- Game State & Menus ---
let isPaused = true;
let isGameStarted = false;
let previousMenu: HTMLElement | null = null; // To know where to go back to

const mainMenu = document.getElementById('main-menu')!;
const pauseMenu = document.getElementById('pause-menu')!;
const settingsMenu = document.getElementById('settings-menu')!;

const btnNewGame = document.getElementById('btn-new-game')!;
const btnContinue = document.getElementById('btn-continue')!;
const btnResume = document.getElementById('btn-resume')!;
const btnExit = document.getElementById('btn-exit')!;

const btnSettingsMain = document.getElementById('btn-settings-main')!;
const btnSettingsPause = document.getElementById('btn-settings-pause')!;
const btnBackSettings = document.getElementById('btn-back-settings')!;
const cbShadows = document.getElementById('cb-shadows') as HTMLInputElement;
const cbClouds = document.getElementById('cb-clouds') as HTMLInputElement;

function showMainMenu() {
    isPaused = true;
    isGameStarted = false;
    mainMenu.style.display = 'flex';
    pauseMenu.style.display = 'none';
    settingsMenu.style.display = 'none';
    inventoryMenu.style.display = 'none';
    document.getElementById('ui-container')!.style.display = 'none';
    if (isMobile) document.getElementById('mobile-ui')!.style.display = 'none';
    
    controls.unlock();
}

function showPauseMenu() {
    isPaused = true;
    pauseMenu.style.display = 'flex';
    mainMenu.style.display = 'none';
    settingsMenu.style.display = 'none';
    controls.unlock();
}

function showSettingsMenu(fromMenu: HTMLElement) {
    previousMenu = fromMenu;
    fromMenu.style.display = 'none';
    settingsMenu.style.display = 'flex';
}

function hideSettingsMenu() {
    settingsMenu.style.display = 'none';
    if (previousMenu) {
        previousMenu.style.display = 'flex';
    } else {
        showMainMenu(); // Fallback
    }
}

function hidePauseMenu() {
    isPaused = false;
    pauseMenu.style.display = 'none';
    settingsMenu.style.display = 'none';
    if (!isMobile) controls.lock();
    prevTime = performance.now();
}

function togglePauseMenu() {
    if (!isGameStarted) return;
    
    // If we are in settings, Go back to pause menu first? 
    // Or just close everything? Let's close everything or go to pause.
    if (settingsMenu.style.display === 'flex') {
        hideSettingsMenu();
        return;
    }

    if (isPaused) {
        hidePauseMenu();
    } else {
        showPauseMenu();
    }
}

async function startGame(loadSave: boolean) {
    if (!isMobile) {
        // Must lock immediately on user gesture
        controls.lock();
    }
    
    // Show Loading
    btnNewGame.innerText = "Loading...";
    btnContinue.innerText = "Loading...";
    
    console.log("Starting game...", loadSave ? "(Loading)" : "(New Game)");
    
    try {
        if (!loadSave) {
            await world.deleteWorld();
            // Reset player state
            playerHP = 20;
            updateHealthUI();
            controls.object.position.set(8, 40, 20);
            velocity.set(0, 0, 0);
            // Clear inventory
            for(let i=0; i<36; i++) {
                inventorySlots[i] = { id: 0, count: 0 };
            }
            refreshInventoryUI();
        } else {
            const data = await world.loadWorld();
            if (data.playerPosition) {
                controls.object.position.copy(data.playerPosition);
                velocity.set(0, 0, 0); 
            }
            if (data.inventory) {
                for(let i=0; i<36; i++) {
                    if (data.inventory[i]) {
                        inventorySlots[i] = data.inventory[i];
                    }
                }
                refreshInventoryUI();
            }
        }

        isGameStarted = true;
        isPaused = false;
        prevTime = performance.now();
        mainMenu.style.display = 'none';
        pauseMenu.style.display = 'none';
        settingsMenu.style.display = 'none'; // Ensure settings are closed
        document.getElementById('ui-container')!.style.display = 'flex';
        if (isMobile) {
            document.getElementById('mobile-ui')!.style.display = 'block';
            document.documentElement.requestFullscreen().catch(() => {});
        }
        
    } catch (e) {
        console.error("Failed to start game:", e);
        alert("Error starting game: " + e);
        // Unlock if failed so user can see alert/menu
        if (!isMobile) controls.unlock();
    } finally {
        btnNewGame.innerText = "New Game";
        btnContinue.innerText = "Continue";
    }
}

// Settings Logic
cbShadows.addEventListener('change', () => {
    environment.setShadowsEnabled(cbShadows.checked);
});

cbClouds.addEventListener('change', () => {
    environment.setCloudsEnabled(cbClouds.checked);
});

// Menu Listeners
btnNewGame.addEventListener('click', () => startGame(false));
btnContinue.addEventListener('click', () => startGame(true));
btnResume.addEventListener('click', () => hidePauseMenu());

btnSettingsMain.addEventListener('click', () => showSettingsMenu(mainMenu));
btnSettingsPause.addEventListener('click', () => showSettingsMenu(pauseMenu));
btnBackSettings.addEventListener('click', () => hideSettingsMenu());

btnExit.addEventListener('click', async () => {
    // Save
    await world.saveWorld({
        position: controls.object.position,
        inventory: inventorySlots
    });
    
    // Return to main menu
    showMainMenu();
});

// Auto-save loop
setInterval(() => {
    if (isGameStarted && !isPaused) {
        world.saveWorld({
            position: controls.object.position,
            inventory: inventorySlots
        });
    }
}, 30000);

// Start Animation Loop immediately, but it will respect isPaused
animate();

// Initial State
showMainMenu();
