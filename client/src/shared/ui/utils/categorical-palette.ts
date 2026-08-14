/*
 * The app's one categorical palette: colours that stand for identity — a person, a numeric type —
 * where the point is telling entries apart, not conveying magnitude.
 *
 * It exists because there were three, all keyed differently: five hues for invitation avatars
 * (hashed by summing char codes), eight for live peer cursors (a polynomial-31 hash), and
 * matplotlib's tab10 by index for atom types. The same concept rendered in three unrelated colour
 * families depending on which surface you were looking at.
 *
 * Not for charts. Charts in this repo are monochrome on purpose — the accent hues fail as a
 * CVD-safe categorical scale, so a series is identified by its label, never by hue. Use
 * chart-theme.ts there.
 */

/*
 * Eight hues, evenly spread around the wheel and readable on both themes. Ordered so that adjacent
 * entries stay distinguishable, since a small set of items takes the first few.
 */
const CATEGORICAL_PALETTE = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316'
] as const;

/*
 * One hash for every caller, so the same key always lands on the same hue. Polynomial-31 with a
 * forced 32-bit wrap: it spreads short, similar keys (`user-1`, `user-2`) far better than summing
 * char codes, which collides heavily because it ignores position.
 */
const hashKey = (key: string): number => {
    let hash = 0;
    for(let index = 0; index < key.length; index += 1){
        hash = (hash * 31 + key.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

/**
 * Stable colour for an identity key (a user id, an email, a type number).
 *
 * The key decides the hue, so two surfaces agree only when they pass the same key. Peer cursors
 * key by user id and invitations key by email — deliberately, since a pending invitation has no
 * user yet — which means those two do not line up for the same person.
 */
export const getCategoricalColor = (key: string): string => {
    if(!key) return CATEGORICAL_PALETTE[0];

    return CATEGORICAL_PALETTE[hashKey(key) % CATEGORICAL_PALETTE.length];
};

/**
 * Colour for a 1-based index (LAMMPS atom types, and anything else numbered from one). Wraps around
 * the palette rather than running out.
 */
export const getCategoricalColorByIndex = (index: number): string => {
    if(!Number.isFinite(index)) return CATEGORICAL_PALETTE[0];

    const zeroBased = Math.max(0, Math.floor(index) - 1);
    return CATEGORICAL_PALETTE[zeroBased % CATEGORICAL_PALETTE.length];
};
