import * as THREE from 'three';

// 0: Transparent
// 1: Handle (Stick)
// 2: Material (Head)

const SWORD_PATTERN = [
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000000220000000",
    "0000001221000000",
    "0000022112200000",
    "0000022112200000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000000110000000"
];

const PICKAXE_PATTERN = [
    "0002222222222000",
    "0022222222222200",
    "0022222222222200",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000000110000000",
    "0000000000000000"
];

const AXE_PATTERN = [
    "0000222222220000",
    "0002222222222200",
    "0022222222222200",
    "0022222211100000",
    "0002222111000000",
    "0000221111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000000110000000",
    "0000000000000000"
];

const STICK_PATTERN = [
    "0000000000000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000001111000000",
    "0000000110000000",
    "0000000000000000"
];

// Colors
const COLORS = {
    HANDLE: '#5C4033', // Dark Brown
    WOOD: '#8B5A2B',   // Wood Planks Color
    STONE: '#7d7d7d'   // Stone Color
};

export interface GeneratedTexture {
    texture: THREE.CanvasTexture;
    dataUrl: string;
}

export function generateToolTexture(pattern: string[], materialColor: string): GeneratedTexture {
    const size = 16; // internal resolution
    const scale = 1; // can be 1, we let CSS scale it up
    
    const canvas = document.createElement('canvas');
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d')!;

    // Disable smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < size; y++) {
        const row = pattern[y];
        for (let x = 0; x < size; x++) {
            const pixel = row[x];
            if (pixel === '0') continue;

            if (pixel === '1') {
                ctx.fillStyle = COLORS.HANDLE;
            } else if (pixel === '2') {
                ctx.fillStyle = materialColor;
            }
            
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }

    // Border/Outline logic (Optional: adds a faint shadow for better visibility)
    // For now, raw pixel art is fine.

    // 1. Create Three.js Texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    // 2. Create DataURL
    const dataUrl = canvas.toDataURL();

    return { texture, dataUrl };
}

// Pre-generate definitions
export const TOOL_DEFS = {
    STICK: { pattern: STICK_PATTERN, color: COLORS.HANDLE }, // Stick is handle material
    WOODEN_SWORD: { pattern: SWORD_PATTERN, color: COLORS.WOOD },
    STONE_SWORD: { pattern: SWORD_PATTERN, color: COLORS.STONE },
    WOODEN_PICKAXE: { pattern: PICKAXE_PATTERN, color: COLORS.WOOD },
    STONE_PICKAXE: { pattern: PICKAXE_PATTERN, color: COLORS.STONE },
    WOODEN_AXE: { pattern: AXE_PATTERN, color: COLORS.WOOD },
    STONE_AXE: { pattern: AXE_PATTERN, color: COLORS.STONE },
};
