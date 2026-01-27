/**
 * Animation constants for canvas rendering.
 * Pure values - no external dependencies.
 */
export const ANIMATION_CONSTANTS = {
    /** Speed for selection box lerp animation */
    SELECTION_LERP_SPEED: 0.18,

    /** Speed for scale lerp animation */
    SCALE_LERP_SPEED: 0.08,

    /** Speed for rotation lerp animation */
    ROTATION_LERP_SPEED: 0.1,

    /** Speed for position lerp animation */
    POSITION_LERP_SPEED: 0.08,

    /** Speed for pulse animation */
    PULSE_SPEED: 0.003,

    /** Minimum allowed scale */
    MIN_SCALE: 0.1,

    /** Maximum allowed scale */
    MAX_SCALE: 5.0,

    /** Scale step for keyboard/scroll interactions */
    SCALE_STEP: 0.1,

    /** Rotation step in radians (PI/24 = 7.5 degrees) */
    ROTATION_STEP: Math.PI / 24,

    /** Selection box padding multiplier */
    SELECTION_BOX_PADDING: 1.06,

    /** Hover box padding multiplier */
    HOVER_BOX_PADDING: 1.04,

    /** Epsilon for rotation comparison */
    ROT_EPS: 1e-3,

    /** Time to wait before settling rotation in milliseconds */
    ROTATION_SETTLE_MS: 160,

    /** Duration of size animation in milliseconds */
    SIZE_ANIM_DURATION_MS: 240
} as const;

/**
 * Type for animation constants.
 */
export type AnimationConstants = typeof ANIMATION_CONSTANTS;

/**
 * Target size for model normalization (in scene units).
 */
export const TARGET_SIZE = 8;

/**
 * Double-click detection threshold in milliseconds.
 */
export const DOUBLE_CLICK_THRESHOLD_MS = 300;
