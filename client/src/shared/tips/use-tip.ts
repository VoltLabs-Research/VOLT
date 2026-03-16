import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import { CONTEXTUAL_TIP_RELEASE_BUFFER_MS } from '@/shared/tips/tip-defaults';
import { buildContextualTipOptions } from '@/shared/tips/tip-defaults';
import { getContextualTipDefinition, type ContextualTipId } from '@/shared/tips/tip-registry';
import { beginContextualTipDisplay, finalizeContextualTipDisplay, releaseContextualTipSlot } from '@/shared/tips/tip-storage';

interface UseTipOptions {
    enabled?: boolean;
    delay?: number;
    triggerKey?: string | number | boolean | null;
};

const useTip = (tipId: ContextualTipId, options: UseTipOptions = {}): void => {
    const { enabled = true, delay, triggerKey } = options;
    const timerRef = useRef<number | null>(null);
    const releaseTimerRef = useRef<number | null>(null);
    const visibilityMonitorRef = useRef<number | null>(null);
    const toastIdRef = useRef<string | null>(null);
    const tip = getContextualTipDefinition(tipId);
    const resolvedDelay = delay ?? tip.delay ?? 1500;

    const clearPendingTimer = useCallback((): void => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const clearReleaseTimer = useCallback((): void => {
        if (releaseTimerRef.current !== null) {
            window.clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
        }
    }, []);

    const clearVisibilityMonitor = useCallback((): void => {
        if (visibilityMonitorRef.current !== null) {
            window.clearInterval(visibilityMonitorRef.current);
            visibilityMonitorRef.current = null;
        }
    }, []);

    const startVisibilityMonitor = useCallback((): void => {
        clearVisibilityMonitor();

        if (typeof document === 'undefined') {
            return;
        }

        visibilityMonitorRef.current = window.setInterval(() => {
            const toastId = toastIdRef.current;

            if (!toastId) {
                clearVisibilityMonitor();
                return;
            }

            const isStillVisible = Array.from(document.querySelectorAll('[data-sileo-title]')).some((element) => {
                return element.textContent?.trim() === tip.title;
            });

            if (isStillVisible) {
                return;
            }

            toastIdRef.current = null;
            clearVisibilityMonitor();
            clearReleaseTimer();
            releaseContextualTipSlot(tipId, toastId);
        }, 400);
    }, [clearReleaseTimer, clearVisibilityMonitor, tip.title, tipId]);

    const dismissCurrentTip = useCallback((): void => {
        const toastId = toastIdRef.current;

        clearPendingTimer();
        clearReleaseTimer();
        clearVisibilityMonitor();

        if (toastId) {
            sileo.dismiss(toastId);
            toastIdRef.current = null;
        }

        releaseContextualTipSlot(tipId, toastId ?? undefined);
    }, [clearPendingTimer, clearReleaseTimer, clearVisibilityMonitor, tipId]);

    useEffect(() => {
        if (!enabled) {
            dismissCurrentTip();
            return;
        }

        if (toastIdRef.current) {
            return;
        }

        clearPendingTimer();

        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;

            if (!beginContextualTipDisplay(tipId)) {
                return;
            }

            try {
                const toastId = sileo.info(buildContextualTipOptions(tip, dismissCurrentTip));
                const releaseDelay = tip.dismissMode === 'auto'
                    ? (tip.duration ?? 6000) + CONTEXTUAL_TIP_RELEASE_BUFFER_MS
                    : null;

                toastIdRef.current = toastId;
                finalizeContextualTipDisplay(tipId, toastId);

                if (releaseDelay !== null) {
                    clearReleaseTimer();
                    releaseTimerRef.current = window.setTimeout(() => {
                        toastIdRef.current = null;
                        clearVisibilityMonitor();
                        releaseContextualTipSlot(tipId, toastId);
                        releaseTimerRef.current = null;
                    }, releaseDelay);
                }

                startVisibilityMonitor();
            } catch {
                clearReleaseTimer();
                clearVisibilityMonitor();
                releaseContextualTipSlot(tipId);
            }
        }, Math.max(0, resolvedDelay));

        return () => {
            clearPendingTimer();
            clearReleaseTimer();
            clearVisibilityMonitor();
        };
    }, [clearPendingTimer, clearReleaseTimer, clearVisibilityMonitor, dismissCurrentTip, enabled, resolvedDelay, startVisibilityMonitor, tip, tipId, triggerKey]);

    useEffect(() => {
        return () => {
            dismissCurrentTip();
        };
    }, [dismissCurrentTip]);
};

export default useTip;
