// Deterministic color for the n-th category of a categorical property when the
// plugin declares no explicit color. Golden-ratio hue stepping keeps colors
// well-separated for any category count. The VOLT client mirrors this formula
// (sorted unique values -> index) so panel swatches match the rendered tubes.
const GOLDEN_RATIO = 0.618033988749895;

const hueToRgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
};

export const fallbackCategoryColor = (index: number): [number, number, number, number] => {
    const hue = (index * GOLDEN_RATIO) % 1.0;
    const saturation = 0.65;
    const lightness = 0.55;
    const q = lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    return [
        hueToRgb(p, q, hue + 1 / 3),
        hueToRgb(p, q, hue),
        hueToRgb(p, q, hue - 1 / 3),
        1
    ];
};

// Stable category -> color assignment: explicit plugin colors win, the rest
// get palette colors by their position among the sorted unknown categories.
export const resolveCategoryColors = (
    categories: Iterable<string>,
    explicitColors: Record<string, [number, number, number, number]> | undefined
): Map<string, [number, number, number, number]> => {
    const explicit = explicitColors ?? {};
    const sorted = Array.from(new Set(categories)).sort();
    const resolved = new Map<string, [number, number, number, number]>();
    let fallbackIndex = 0;
    for (const category of sorted) {
        const color = explicit[category];
        if (color) {
            resolved.set(category, color);
        } else {
            resolved.set(category, fallbackCategoryColor(fallbackIndex));
            fallbackIndex += 1;
        }
    }
    return resolved;
};
