const NICE_STEPS = [1, 2, 5];

// The smallest 1, 2 or 5 times a power of ten that is at least `minimum` and a multiple of `unit`.
const niceMultipleOf = (unit: number, minimum: number): number | undefined => {
    for (let scale = 1; scale <= Number.MAX_SAFE_INTEGER; scale *= 10) {
        for (const step of NICE_STEPS) {
            const candidate = step * scale;
            if (candidate >= minimum && candidate % unit === 0) return candidate;
        }
    }
    return undefined;
};

const uniformSpacing = (timesteps: number[]): number | undefined => {
    const unit = timesteps[1] - timesteps[0];
    if (!(unit > 0) || timesteps[0] % unit !== 0) return undefined;
    for (let index = 2; index < timesteps.length; index++) {
        if (timesteps[index] - timesteps[index - 1] !== unit) return undefined;
    }
    return unit;
};

/**
 * The indices of the timesteps the ruler labels, at least `minSpacing` px apart over `width` px.
 * Evenly spaced timesteps get round numbers (100000, 200000, …); uneven ones every Nth frame.
 */
export const labelledIndices = (timesteps: number[], width: number, minSpacing: number): number[] => {
    if (timesteps.length === 0 || width <= 0) return [];
    if (timesteps.length === 1) return [0];

    const framesApart = minSpacing / (width / (timesteps.length - 1));
    const unit = uniformSpacing(timesteps);
    const valueStep = unit !== undefined ? niceMultipleOf(unit, framesApart * unit) : undefined;
    const roundIndices = valueStep === undefined ? [] : timesteps.flatMap((timestep, index) => (timestep % valueStep === 0 ? [index] : []));
    if (roundIndices.length > 0) return roundIndices;

    const indexStep = niceMultipleOf(1, Math.ceil(framesApart)) ?? timesteps.length;
    const indices: number[] = [];
    for (let index = 0; index < timesteps.length; index += indexStep) indices.push(index);
    return indices;
};
