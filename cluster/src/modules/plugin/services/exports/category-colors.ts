/**
 * Resolves a colour for a named category, for any exporter that colours geometry by
 * one of its own categorical properties.
 *
 * VOLT holds no opinion about what the categories mean. A plugin that cares about the
 * colour of a category declares it (`propertyColors` in its plugin.json, or a colour
 * on the row itself); anything undeclared gets a deterministic generated colour. That
 * is the whole contract: a plugin can introduce a category tomorrow and it renders,
 * legends included, with no change here.
 *
 * The deliberate consequence is that the daemon has no table of "FCC is green". If a
 * structure-identification plugin wants OVITO's palette, it ships OVITO's palette.
 */

const GOLDEN_RATIO = 0.618033988749895;

export const hueToRgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    if (s === 0) {
        return [l, l, l];
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hueToRgb(p, q, h + 1 / 3),
        hueToRgb(p, q, h),
        hueToRgb(p, q, h - 1 / 3)
    ];
};

/**
 * Distinct, evenly spread colours for the first two dozen categories, then a
 * golden-ratio hue walk. Carries no meaning -- it exists so that an undeclared
 * category is still legible and, above all, stable.
 */
const GENERATED_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [0.91, 0.30, 0.24],
    [0.20, 0.60, 0.86],
    [0.18, 0.80, 0.44],
    [0.95, 0.77, 0.06],
    [0.61, 0.35, 0.71],
    [1.00, 0.50, 0.00],
    [0.00, 0.81, 0.82],
    [0.85, 0.20, 0.53],
    [0.55, 0.76, 0.22],
    [0.36, 0.25, 0.60],
    [1.00, 0.62, 0.47],
    [0.00, 0.50, 0.50],
    [0.80, 0.68, 0.00],
    [0.44, 0.68, 0.28],
    [0.69, 0.19, 0.38],
    [0.30, 0.75, 0.93],
    [0.90, 0.56, 0.67],
    [0.50, 0.50, 0.00],
    [0.00, 0.39, 0.74],
    [0.75, 0.94, 0.27],
    [0.58, 0.00, 0.83],
    [0.94, 0.42, 0.31],
    [0.27, 0.94, 0.94],
    [0.66, 0.47, 0.33]
];

/**
 * `Cluster 7` pins the generated colour to index 7 rather than to the category's
 * position in a sorted list. This is an index rule, not a palette: it keeps a
 * cluster's colour from shifting between frames as other clusters appear and vanish.
 * A plugin that wants specific cluster colours still declares them and wins.
 */
const INDEXED_CATEGORY_RE = /^Cluster\s+(\d+)$/i;

export const normalizeCategoryName = (name: string): string =>
    name.trim().toLowerCase().replace(/[\s-]+/g, '_');

export const generatedCategoryColor = (index: number): [number, number, number] => {
    const wrapped = Math.max(0, Math.trunc(index));
    if (wrapped < GENERATED_PALETTE.length) {
        const color = GENERATED_PALETTE[wrapped];
        return [color[0], color[1], color[2]];
    }

    const hue = ((wrapped - GENERATED_PALETTE.length) * GOLDEN_RATIO) % 1.0;
    const saturation = 0.65 + (wrapped % 3) * 0.1;
    const lightness = 0.45 + (wrapped % 2) * 0.12;
    return hslToRgb(hue, saturation, lightness);
};

export type CategoryColor = [number, number, number, number];

/**
 * Declared colours, keyed by category name. Lookup is case- and separator-insensitive
 * so a plugin declaring `CUBIC_DIAMOND` still matches a row spelled
 * `Cubic diamond` -- convenience for plugin authors, not interpretation of the name.
 */
const buildDeclaredIndex = (
    explicitColors: Record<string, CategoryColor> | undefined
): Map<string, CategoryColor> => {
    const index = new Map<string, CategoryColor>();
    for (const [name, color] of Object.entries(explicitColors ?? {})) {
        index.set(normalizeCategoryName(name), color);
    }
    return index;
};

export const resolveCategoryColors = (
    categories: Iterable<string>,
    explicitColors: Record<string, CategoryColor> | undefined
): Map<string, CategoryColor> => {
    const declared = buildDeclaredIndex(explicitColors);
    const sorted = Array.from(new Set(categories)).sort();
    const resolved = new Map<string, CategoryColor>();

    let generatedIndex = 0;
    for (const category of sorted) {
        const declaredColor = declared.get(normalizeCategoryName(category));
        if (declaredColor) {
            resolved.set(category, declaredColor);
            continue;
        }

        const indexed = INDEXED_CATEGORY_RE.exec(category);
        if (indexed) {
            const [red, green, blue] = generatedCategoryColor(Number.parseInt(indexed[1], 10));
            resolved.set(category, [red, green, blue, 1]);
            continue;
        }

        const [red, green, blue] = generatedCategoryColor(generatedIndex);
        generatedIndex += 1;
        resolved.set(category, [red, green, blue, 1]);
    }

    return resolved;
};
