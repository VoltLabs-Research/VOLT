import { Keyboard, Lightbulb } from 'lucide-react';
import type { SileoOptions } from 'sileo';
import type { ContextualTipDefinition } from '@/shared/tips/tip-registry';

export const AUTO_CONTEXTUAL_TIP_DURATION_MS = 6000;
const MANUAL_CONTEXTUAL_TIP_DURATION_MS = 2_147_483_647;
export const CONTEXTUAL_TIP_RELEASE_BUFFER_MS = 700;

/**
 * `sileo` takes the tip's chrome as four `className` strings and applies them to
 * the slots it renders itself, so these are utilities rather than a stylesheet —
 * the toast is a third-party surface we hand classes to, not markup we own.
 *
 * The button's soft fill was `color-mix(in srgb, var(--accent-blue) 12%, transparent)`
 * rising to 18% on hover, which is what HeroUI's `--accent-soft` /
 * `--accent-soft-hover` pair already is (15%→20% light, 12%→16% dark), so the
 * tint is expressed through those rather than restated. The local
 * `:focus-visible` outline is gone because `index.css` rings every `<button>`
 * with `--focus` globally; the ring is the same, it is just no longer declared
 * twice.
 */
const CONTEXTUAL_TIP_STYLES = {
    title: 'font-semibold tracking-[-0.01em] normal-case whitespace-nowrap',
    description: 'flex flex-col gap-2 text-muted leading-[1.45] text-pretty',
    badge: 'text-accent',
    button: 'self-start inline-flex items-center justify-center min-h-8 px-3 py-[0.35rem] rounded-full bg-accent-soft text-accent text-[0.8rem] font-semibold no-underline transition-colors duration-150 hover:bg-accent-soft-hover focus-visible:bg-accent-soft-hover'
} as const;

type ContextualTipVariant = 'default' | 'shortcut';

export const buildContextualTipOptions = (
    tip: ContextualTipDefinition,
    onManualDismiss?: () => void,
    variant: ContextualTipVariant = 'default'
): SileoOptions => {
    return {
        title: tip.title,
        description: tip.description,
        type: 'info',
        position: 'bottom-right',
        duration: tip.dismissMode === 'manual'
            ? MANUAL_CONTEXTUAL_TIP_DURATION_MS
            : tip.duration ?? AUTO_CONTEXTUAL_TIP_DURATION_MS,
        autopilot: !tip.description
            ? false
            : tip.dismissMode === 'manual'
                ? {
                    expand: 180,
                    collapse: 0
                }
                : true,
        icon: variant === 'shortcut'
            ? <Keyboard size={14} strokeWidth={1.8} />
            : <Lightbulb size={14} strokeWidth={1.8} />,
        fill: 'var(--surface-tertiary)',
        roundness: 18,
        styles: CONTEXTUAL_TIP_STYLES,
        button: tip.dismissMode === 'manual' && onManualDismiss
            ? {
                title: tip.buttonLabel ?? 'Got it',
                onClick: onManualDismiss
            }
            : undefined
    };
};
