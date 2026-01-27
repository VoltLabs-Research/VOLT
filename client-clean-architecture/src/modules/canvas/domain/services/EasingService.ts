/**
 * Easing functions for animations.
 * Pure functions - deterministic, no side effects.
 * All functions take a parameter t in range [0, 1] and return a value in range [0, 1].
 */

/**
 * Cubic ease-out function.
 * Starts fast and decelerates.
 *
 * @param t - Progress value between 0 and 1
 * @returns Eased value between 0 and 1
 */
export const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
};

/**
 * Cubic ease-in function.
 * Starts slow and accelerates.
 *
 * @param t - Progress value between 0 and 1
 * @returns Eased value between 0 and 1
 */
export const easeInCubic = (t: number): number => {
    return Math.pow(t, 3);
};

/**
 * Cubic ease-in-out function.
 * Starts slow, accelerates, then decelerates.
 *
 * @param t - Progress value between 0 and 1
 * @returns Eased value between 0 and 1
 */
export const easeInOutCubic = (t: number): number => {
    return t < 0.5
        ? 4 * Math.pow(t, 3)
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Linear interpolation between two values.
 * Pure function.
 *
 * @param from - Start value
 * @param to - End value
 * @param t - Progress value between 0 and 1
 * @returns Interpolated value
 */
export const lerp = (from: number, to: number, t: number): number => {
    return from + (to - from) * t;
};

/**
 * Linear interpolation with easing.
 * Pure function.
 *
 * @param from - Start value
 * @param to - End value
 * @param t - Progress value between 0 and 1
 * @param easingFn - Easing function to apply
 * @returns Eased interpolated value
 */
export const lerpWithEasing = (
    from: number,
    to: number,
    t: number,
    easingFn: (t: number) => number
): number => {
    return lerp(from, to, easingFn(t));
};

/**
 * Clamps a value between min and max.
 * Pure function.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

/**
 * Computes animation progress given elapsed time and duration.
 * Pure function.
 *
 * @param elapsedMs - Elapsed time in milliseconds
 * @param durationMs - Total duration in milliseconds
 * @returns Progress value clamped between 0 and 1
 */
export const computeAnimationProgress = (elapsedMs: number, durationMs: number): number => {
    return clamp(elapsedMs / durationMs, 0, 1);
};
