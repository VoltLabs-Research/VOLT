import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import {
    AUTO_CONTEXTUAL_TIP_DURATION_MS,
    CONTEXTUAL_TIP_RELEASE_BUFFER_MS,
    buildContextualTipOptions
} from '@/shared/tips/tip-defaults';
import { getContextualTipDefinition } from '@/shared/tips/tip-registry';
import type { ContextualTipId } from '@/shared/tips/tip-registry';
import { beginContextualTipDisplay, finalizeContextualTipDisplay, releaseContextualTipSlot } from '@/shared/tips/tip-storage';

const useShortcutDiscovery = (tipId: ContextualTipId) => {
    const toastIdRef = useRef<string | null>(null);
    const releaseTimerRef = useRef<number | null>(null);
    const tip = getContextualTipDefinition(tipId);

    const clearReleaseTimer = useCallback((): void => {
        if (releaseTimerRef.current !== null) {
            window.clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
        }
    }, []);

    const dismissShortcutTip = useCallback((): void => {
        const toastId = toastIdRef.current;

        clearReleaseTimer();

        if (toastId) {
            sileo.dismiss(toastId);
            toastIdRef.current = null;
        }

        releaseContextualTipSlot(tipId, toastId ?? undefined);
    }, [clearReleaseTimer, tipId]);

    const recordSlowAction = useCallback((): void => {
        if (toastIdRef.current) {
            return;
        }

        if (!beginContextualTipDisplay(tipId)) {
            return;
        }

        try {
            const toastId = sileo.info(buildContextualTipOptions(tip, undefined, 'shortcut'));
            const displayDuration = tip.duration ?? AUTO_CONTEXTUAL_TIP_DURATION_MS;

            toastIdRef.current = toastId;
            finalizeContextualTipDisplay(tipId, toastId);
            clearReleaseTimer();
            releaseTimerRef.current = window.setTimeout(() => {
                toastIdRef.current = null;
                releaseContextualTipSlot(tipId, toastId);
                releaseTimerRef.current = null;
            }, displayDuration + CONTEXTUAL_TIP_RELEASE_BUFFER_MS);
        } catch {
            releaseContextualTipSlot(tipId);
        }
    }, [clearReleaseTimer, tip, tipId]);

    useEffect(() => {
        return () => {
            dismissShortcutTip();
        };
    }, [dismissShortcutTip]);

    return {
        recordSlowAction
    };
};

export default useShortcutDiscovery;
