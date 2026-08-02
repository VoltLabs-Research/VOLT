const GOLDEN_RATIO = 0.618033988749895;

const toHexChannel = (value: number): string => {
    return Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
};

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
    const degrees = hue * 360;
    const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
    const secondary = chroma * (1 - Math.abs(((degrees / 60) % 2) - 1));
    const match = lightness - (chroma / 2);
    let red = 0;
    let green = 0;
    let blue = 0;
    if (degrees < 60) { red = chroma; green = secondary; }
    else if (degrees < 120) { red = secondary; green = chroma; }
    else if (degrees < 180) { green = chroma; blue = secondary; }
    else if (degrees < 240) { green = secondary; blue = chroma; }
    else if (degrees < 300) { red = secondary; blue = chroma; }
    else { red = chroma; blue = secondary; }
    return `#${toHexChannel(red + match)}${toHexChannel(green + match)}${toHexChannel(blue + match)}`;
};

export const hexToRgba = (hex: string): [number, number, number, number] => {
    const normalized = hex.replace('#', '');
    return [
        parseInt(normalized.slice(0, 2), 16) / 255,
        parseInt(normalized.slice(2, 4), 16) / 255,
        parseInt(normalized.slice(4, 6), 16) / 255,
        1
    ];
};

export const rgbaToHex = (rgba: [number, number, number, number]): string => {
    return `#${toHexChannel(rgba[0])}${toHexChannel(rgba[1])}${toHexChannel(rgba[2])}`;
};

/**
 * Mirrors the daemon-side `fallbackCategoryColor` palette (see ClusterDaemon
 * `plugin/services/exports/category-colors.ts`) so legend swatches match the
 * colors baked into the exported geometry.
 */
export const goldenRatioColor = (fallbackIndex: number): string => {
    return hslToHex((fallbackIndex * GOLDEN_RATIO) % 1, 0.65, 0.55);
};
