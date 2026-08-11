import { cn } from '@heroui/react';

/**
 * bravais's `StatusDot`, at the only size and the only four tones this module used.
 *
 * The dot has no HeroUI equivalent (spec §4c sends it to
 * `<span className='size-2 rounded-full bg-success'>`), so the four pieces of
 * StatusDot.css that were load-bearing are restated as utilities:
 *
 *   1. `size-sm` → 8×8. bravais's `size-sm` was its own class, NOT Tailwind's
 *      numeric `size-*`, so this is `size-2` by pixel value, not by name.
 *   2. every tone carried `box-shadow: 0 0 0 2px var(--color-surface-1)` — a 2px
 *      punch-out ring, which is what keeps the dot from merging into whatever it
 *      sits on. `--color-surface-1` is HeroUI's `--surface-secondary`.
 *   3. `pulse` was `animation: animate-pulse 1.5s ease-in-out infinite`, keyframes
 *      opacity 1 → 0.4 → 1. Tailwind ships `@keyframes pulse` (50% opacity .5), so
 *      the arbitrary-animation value reuses it at bravais's own timing rather than
 *      taking `animate-pulse`'s 2s cubic-bezier.
 *   4. `glow` was an `::after` at `inset:-4px` with `background: currentColor`,
 *      `opacity: 0`, animated 0 → 0.45 → 0 by `@keyframes status-dot-glow`. The
 *      pseudo-element is reachable through the `after:*` variants; the keyframes
 *      are not, so `pulse` drives it instead — 0 → 0.5 → 0, which is the same
 *      halo minus its 0.9→1.15 scale breath. `currentColor` is why each tone sets
 *      a text colour as well as a background.
 *
 * The reduced-motion opt-out both animations had is now global in `index.css`.
 *
 * `role='status'` and the `${tone} status` fallback name are bravais's and are
 * kept: a list of dots is a list of live regions today, which is arguably a bug,
 * but changing it changes what a screen reader announces.
 */
type ClusterDotTone = 'success' | 'warning' | 'danger' | 'neutral';

const DOT_CLASS = 'relative inline-block size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]';

const TONE_CLASS: Record<ClusterDotTone, string> = {
    success: 'bg-success text-success',
    warning: 'bg-warning text-warning',
    danger: 'bg-danger text-danger',
    neutral: 'bg-muted text-muted'
};

const PULSE_CLASS = 'animate-[pulse_1.5s_ease-in-out_infinite]';

const GLOW_CLASS = "after:pointer-events-none after:absolute after:-inset-1 after:rounded-full after:bg-current after:opacity-0 after:content-[''] after:animate-[pulse_1.8s_ease-in-out_infinite]";

interface ClusterStatusDotProps {
    tone: ClusterDotTone;
    pulse?: boolean;
    glow?: boolean;
    label?: string;
};

const ClusterStatusDot = ({ tone, pulse = false, glow = false, label }: ClusterStatusDotProps) => (
    <span
        className={cn(DOT_CLASS, TONE_CLASS[tone], pulse && PULSE_CLASS, glow && GLOW_CLASS)}
        role='status'
        aria-label={label ?? `${tone} status`}
    />
);

export default ClusterStatusDot;
