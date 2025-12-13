export interface PageVariantsConfig {
    reducedMotion: boolean;
    isSameLayout: boolean;
}

export interface AnimationTimings {
    enter: number;
    exit: number;
    opacity: number;
    delay: number;
}

export type LayoutKey = 'dashboard' | 'auth' | 'canvas' | 'default';
