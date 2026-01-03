import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World, BLOCK } from './World';
import { ItemEntity } from './ItemEntity';
import { MobManager } from './MobManager';
import './style.css';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
if (isMobile) {
  document.body.classList.add('is-mobile');
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.set(8, 20, 20);
camera.lookAt(8, 8, 8);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile }); // Disable AA on mobile for perf
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio to prevent lag on high-DPI phones
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = !isMobile; // Disable shadows by default on mobile
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
      if (!isPaused) toggleInventory();
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
  20: 'Деревянный меч',
  21: 'Каменный меч',
  22: 'Деревянная кирка',
  23: 'Каменная кирка',
  24: 'Деревянный топор',
  25: 'Каменный топор'
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
            'wooden_sword': 20,
            'stone_sword': 21,
            'wooden_pickaxe': 22,
            'stone_pickaxe': 23,
            'wooden_axe': 24,
            'stone_axe': 25
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
      handleSlotClick(index);
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
        
        if (slot.id === 8) { // Stick
            icon.classList.add('item-stick');
            icon.style.backgroundColor = 'transparent';
        } else if (slot.id === 7) { // Planks
            icon.classList.add('item-planks');
        } else if (slot.id >= 20) { // Tools
            icon.classList.add('item-tool');
            if (slot.id === 20 || slot.id === 21) icon.classList.add('tool-sword');
            if (slot.id === 22 || slot.id === 23) icon.classList.add('tool-pickaxe');
            if (slot.id === 24 || slot.id === 25) icon.classList.add('tool-axe');
            
            if (slot.id % 2 === 0) icon.classList.add('mat-wood'); // 20, 22, 24
            else icon.classList.add('mat-stone'); // 21, 23, 25
        }
        
        countEl.innerText = slot.count.toString();
      } else {
        icon.style.display = 'none';
        countEl.innerText = '';
      }
  });
}

function initInventoryUI() {
  hotbarContainer.innerHTML = '';
  inventoryGrid.innerHTML = '';

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
}

function toggleInventory() {
  isInventoryOpen = !isInventoryOpen;
  
  if (isInventoryOpen) {
    controls.unlock();
    inventoryMenu.style.display = 'flex';
    refreshInventoryUI();
  } else {
    // Auto-save on close
    world.saveWorld({
        position: controls.object.position,
        inventory: inventorySlots
    });

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

function handleSlotClick(index: number) {
  const slot = inventorySlots[index];

  if (!draggedItem) {
    if (slot.id !== 0) {
      draggedItem = { ...slot };
      slot.id = 0;
      slot.count = 0;
    }
  } else {
    if (slot.id === 0) {
      slot.id = draggedItem.id;
      slot.count = draggedItem.count;
      draggedItem = null;
    } else if (slot.id === draggedItem.id) {
      slot.count += draggedItem.count;
      draggedItem = null;
    } else {
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
    icon.style.backgroundColor = getBlockColor(draggedItem.id);
    
    if (draggedItem.id === 8) {
        icon.classList.add('item-stick');
        icon.style.backgroundColor = 'transparent';
    } else if (draggedItem.id === 7) {
        icon.classList.add('item-planks');
    } else if (draggedItem.id >= 20) {
        icon.classList.add('item-tool');
        if (draggedItem.id === 20 || draggedItem.id === 21) icon.classList.add('tool-sword');
        if (draggedItem.id === 22 || draggedItem.id === 23) icon.classList.add('tool-pickaxe');
        if (draggedItem.id === 24 || draggedItem.id === 25) icon.classList.add('tool-axe');
        
        if (draggedItem.id % 2 === 0) icon.classList.add('mat-wood');
        else icon.classList.add('mat-stone');
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
      if (targetIndex !== -1 && targetIndex !== touchStartSlotIndex) {
        handleSlotClick(targetIndex);
      }
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
  } else {
    hotbarLabel.style.opacity = '0';
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
            entities.push(new ItemEntity(world, scene, x, y, z, currentBreakId, world.noiseTexture));
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
  controls.object.position.set(8, 20, 8);
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
      performAttack(); // Hit mobs
      startBreaking(); // Start mining block
  }
  else if (event.button === 2) performInteract();
});

document.addEventListener('mouseup', () => {
   if (isAttackPressed) isAttackPressed = false;
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
        controls.object.position.set(8, 20, 20);
        velocity.set(0, 0, 0);
    }
  }

  prevTime = time;

  renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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

      toggleInventory();

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
            controls.object.position.set(8, 20, 20);
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
