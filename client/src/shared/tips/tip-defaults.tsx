import '@/shared/tips/contextual-tip.css';
import { Keyboard, Lightbulb } from 'lucide-react';
import type { SileoOptions } from 'sileo';
import type { ContextualTipDefinition } from '@/shared/tips/tip-registry';

export const AUTO_CONTEXTUAL_TIP_DURATION_MS = 6000;
export const MANUAL_CONTEXTUAL_TIP_DURATION_MS = 2_147_483_647;
export const CONTEXTUAL_TIP_RELEASE_BUFFER_MS = 700;

const CONTEXTUAL_TIP_STYLES = {
    title: 'contextual-tip__title',
    description: 'contextual-tip__description',
    badge: 'contextual-tip__badge',
    button: 'contextual-tip__button'
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
                ? { expand: 180, collapse: 0 }
                : true,
        icon: variant === 'shortcut'
            ? <Keyboard size={14} strokeWidth={1.8} />
            : <Lightbulb size={14} strokeWidth={1.8} />,
        fill: 'var(--color-surface-2)',
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
