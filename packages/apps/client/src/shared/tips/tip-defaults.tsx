import { Lightbulb } from 'lucide-react';
import type { SileoOptions } from 'sileo';
import type { ContextualTipDefinition } from '@/shared/tips/tip-registry';

const AUTO_CONTEXTUAL_TIP_DURATION_MS = 6000;
const MANUAL_CONTEXTUAL_TIP_DURATION_MS = 2_147_483_647;
export const CONTEXTUAL_TIP_RELEASE_BUFFER_MS = 700;

export const buildContextualTipOptions = (
    tip: ContextualTipDefinition,
    onManualDismiss?: () => void
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
        icon: <Lightbulb size={14} strokeWidth={1.8} />,
        // Fill, roundness and colours are the Toaster's, from the theme, as every other toast.
        styles: {
            description: 'flex flex-col gap-2 text-pretty'
        },
        button: tip.dismissMode === 'manual' && onManualDismiss
            ? {
                title: tip.buttonLabel ?? 'Got it',
                onClick: onManualDismiss
            }
            : undefined
    };
};
