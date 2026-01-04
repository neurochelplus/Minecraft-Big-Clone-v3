// 0: Transparent (Not used for blocks usually, but kept for consistency)
// 1: Primary Color
// 2: Secondary Color (Darker detail)

export const CT_TOP_PATTERN = [
    "2222222222222222",
    "2111111111111112",
    "2111111111111112",
    "2112222222222112",
    "2112112112112112",
    "2112112112112112",
    "2112222222222112",
    "2112112112112112",
    "2112112112112112",
    "2112222222222112",
    "2112112112112112",
    "2112112112112112",
    "2112222222222112",
    "2111111111111112",
    "2111111111111112",
    "2222222222222222",
];

export const CT_SIDE_PATTERN = [
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
    "2222222222222222",
];

export const PLANKS_PATTERN = [
    // Simple procedural noise fallback or defined pattern
    // For now we use a placeholder or assume procedural generation for noise-based blocks
    // but here is a simple planks pattern if needed
    "1111111111111111",
    "1111111111111111",
    "1111111111111111",
    "2222222222222222",
    "1111111111111111",
    "1111111111111111",
    "1111111111111111",
    "2222222222222222",
    "1111111111111111",
    "1111111111111111",
    "1111111111111111",
    "2222222222222222",
    "1111111111111111",
    "1111111111111111",
    "1111111111111111",
    "2222222222222222",
];

export const BLOCK_COLORS = {
    WOOD_PRIMARY: '#B47850',   // Light Brown (180, 120, 80)
    WOOD_SECONDARY: '#50321E'  // Dark Brown (80, 50, 30)
};

export interface BlockTextureDef {
    pattern?: string[];
    colors?: { primary: string, secondary: string };
}

export const BLOCK_DEFS: Record<string, BlockTextureDef> = {
    CRAFTING_TABLE_TOP: { pattern: CT_TOP_PATTERN, colors: { primary: BLOCK_COLORS.WOOD_PRIMARY, secondary: BLOCK_COLORS.WOOD_SECONDARY } },
    CRAFTING_TABLE_SIDE: { pattern: CT_SIDE_PATTERN, colors: { primary: BLOCK_COLORS.WOOD_PRIMARY, secondary: BLOCK_COLORS.WOOD_SECONDARY } },
    // Bottom uses planks logic usually, or can use PLANKS_PATTERN
};

// Helper to convert hex to rgb
export function hexToRgb(hex: string): { r: number, g: number, b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}
