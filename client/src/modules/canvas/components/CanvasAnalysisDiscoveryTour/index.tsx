import { Button } from '@heroui/react';
import { Check, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const TOUR_STORAGE_KEY_PREFIX = 'volt:tutorial:canvas-analysis-discovery:v1';

const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';
const TOUR_SELECT_TIMELINE_TAB_EVENT = 'canvas-analysis-tour:select-timeline-tab';
const TARGET_GAP = 12;
const VIEWPORT_MARGIN = 12;
const CARD_ESTIMATED_HEIGHT = 146;
const OPTIONAL_TARGET_SKIP_DELAY = 360;

interface CanvasAnalysisDiscoveryTourProps {
    enabled: boolean;
    storageScopeId: string;
    isMobile: boolean;
    rightDrawerOpen: boolean;
    onRightDrawerOpenChange: (open: boolean) => void;
    onActiveChange?: (active: boolean) => void;
    onComplete?: () => void;
}

interface TourStep {
    id: string;
    title: string;
    description: string;
    targetSelector: string;
    requiresAnalysisPanel?: boolean;
    requiresTimelineTab?: boolean;
    optional?: boolean;
}

interface TargetLayout {
    spotlightStyle: CSSProperties;
    cardStyle: CSSProperties;
}

const getTourStorageKey = (storageScopeId: string): string => {
    return `${TOUR_STORAGE_KEY_PREFIX}:${storageScopeId}`;
};

const hasCompletedTour = (storageScopeId: string): boolean => {
    try {
        return window.localStorage.getItem(getTourStorageKey(storageScopeId)) === 'completed';
    } catch {
        return false;
    }
};

const markTourCompleted = (storageScopeId: string): void => {
    try {
        window.localStorage.setItem(getTourStorageKey(storageScopeId), 'completed');
    } catch {
    }
};

const pollUntilSettled = (intervalMs: number, tick: () => boolean): (() => void) => {
    const timer = window.setInterval(() => {
        if (tick()) window.clearInterval(timer);
    }, intervalMs);

    return () => window.clearInterval(timer);
};

const buildSteps = (isMobile: boolean): TourStep[] => {
    const sharedSteps: TourStep[] = [{
        id: 'analysis-section',
        title: 'Analysis panel',
        description: 'This panel lists the analysis results available for the trajectory.',
        targetSelector: '[data-tour-id="canvas-analyses-section"]',
        requiresAnalysisPanel: true
    }, {
        id: 'per-timestep',
        title: 'Per-timestep analyses',
        description: 'When present, these results are tied to the current frame in the timeline.',
        targetSelector: '[data-tour-id="canvas-per-timestep-analyses-section"]',
        requiresAnalysisPanel: true,
        optional: true
    }, {
        id: 'timeline-tabs',
        title: 'Timeline tabs',
        description: isMobile
            ? 'Use this selector to switch between the timeline, particles, simulation cell, logs, and analysis result tables.'
            : 'Use these tabs to switch between the timeline, particles, simulation cell, logs, and analysis result tables.',
        targetSelector: isMobile
            ? '[data-tour-id="canvas-timeline-tab-selector"]'
            : '[data-tour-id="canvas-timeline-tabs"]'
    }, {
        id: 'timeline-ruler',
        title: 'Scrub timesteps',
        description: isMobile
            ? 'Tap a timestep directly, or drag across the ruler to scrub through frames.'
            : 'Click or drag across the ruler to scrub through frames.',
        targetSelector: '[data-tour-id="canvas-timeline-ruler"]',
        requiresTimelineTab: true
    }];

    if (!isMobile) {
        return sharedSteps;
    }

    return [{
        id: 'open-panel',
        title: 'Analysis controls',
        description: 'Open this panel to inspect the analyses available for this public trajectory.',
        targetSelector: '[data-tour-id="canvas-analysis-panel-toggle"]'
    }, ...sharedSteps];
};

const buildTargetLayout = (targetRect: DOMRect, isMobile: boolean): TargetLayout => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardWidth = Math.min(isMobile ? 300 : 324, viewportWidth - VIEWPORT_MARGIN * 2);
    const targetCenter = targetRect.left + targetRect.width / 2;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN);
    const left = Math.min(Math.max(targetCenter - cardWidth / 2, VIEWPORT_MARGIN), maxLeft);
    const preferredTop = targetRect.bottom + TARGET_GAP;
    const top = preferredTop + CARD_ESTIMATED_HEIGHT > viewportHeight
        ? Math.max(VIEWPORT_MARGIN, targetRect.top - CARD_ESTIMATED_HEIGHT - TARGET_GAP)
        : preferredTop;

    return {
        spotlightStyle: {
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12
        },
        cardStyle: {
            top,
            left,
            width: cardWidth
        }
    };
};

const CanvasAnalysisDiscoveryTour = ({
    enabled,
    storageScopeId,
    isMobile,
    rightDrawerOpen,
    onRightDrawerOpenChange,
    onActiveChange,
    onComplete
}: CanvasAnalysisDiscoveryTourProps) => {
    const steps = useMemo(() => buildSteps(isMobile), [isMobile]);
    const [isActive, setIsActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [layout, setLayout] = useState<TargetLayout | null>(null);
    const hasStartedRef = useRef(false);
    const completedPanelAutoSelectRef = useRef(false);
    const activeStep = steps[stepIndex];

    const completeTour = useCallback(() => {
        markTourCompleted(storageScopeId);
        setIsActive(false);
        onComplete?.();
    }, [onComplete, storageScopeId]);

    useEffect(() => {
        onActiveChange?.(isActive);
        return () => onActiveChange?.(false);
    }, [isActive, onActiveChange]);

    const goToNextStep = useCallback(() => {
        if (stepIndex >= steps.length - 1) {
            completeTour();
            return;
        }

        setStepIndex(stepIndex + 1);
    }, [completeTour, stepIndex, steps.length]);

    useEffect(() => {
        if (!enabled || hasStartedRef.current || hasCompletedTour(storageScopeId)) {
            return;
        }

        const timer = window.setTimeout(() => {
            hasStartedRef.current = true;
            completedPanelAutoSelectRef.current = false;
            setStepIndex(0);
            setIsActive(true);
        }, 700);

        return () => window.clearTimeout(timer);
    }, [enabled, storageScopeId]);

    useEffect(() => {
        if (!isActive || !activeStep?.requiresAnalysisPanel || !isMobile || rightDrawerOpen) {
            return;
        }

        onRightDrawerOpenChange(true);
    }, [activeStep, isActive, isMobile, onRightDrawerOpenChange, rightDrawerOpen]);

    useEffect(() => {
        if (!isActive || activeStep?.id !== 'analysis-section' || completedPanelAutoSelectRef.current) {
            return;
        }

        let attempts = 0;

        return pollUntilSettled(160, () => {
            window.dispatchEvent(new CustomEvent(TOUR_SELECT_ANALYSIS_EVENT));
            attempts += 1;

            const selectedAnalysis = document.querySelector('[data-tour-id="canvas-first-analysis-row"]');
            const settled = selectedAnalysis?.getAttribute('aria-selected') === 'true' || attempts >= 24;
            if (settled) {
                completedPanelAutoSelectRef.current = true;
            }

            return settled;
        });
    }, [activeStep, isActive]);

    useEffect(() => {
        if (!isActive || !activeStep?.requiresTimelineTab) {
            return;
        }

        let attempts = 0;
        const stopPolling = pollUntilSettled(120, () => {
            window.dispatchEvent(new CustomEvent(TOUR_SELECT_TIMELINE_TAB_EVENT));
            attempts += 1;

            return Boolean(document.querySelector(activeStep.targetSelector)) || attempts >= 16;
        });

        window.dispatchEvent(new CustomEvent(TOUR_SELECT_TIMELINE_TAB_EVENT));

        return stopPolling;
    }, [activeStep, isActive]);

    useEffect(() => {
        if (!isActive || !activeStep) {
            setLayout(null);
            return;
        }

        let frameId = 0;

        const updateLayout = () => {
            const target = document.querySelector(activeStep.targetSelector);
            if (!target) {
                setLayout(null);
                return;
            }

            setLayout(buildTargetLayout(target.getBoundingClientRect(), isMobile));
        };

        const scheduleUpdate = () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(updateLayout);
        };

        scheduleUpdate();
        const interval = window.setInterval(scheduleUpdate, 220);
        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('scroll', scheduleUpdate, true);

        const optionalTargetTimer = activeStep.optional
            ? window.setTimeout(() => {
                if (!document.querySelector(activeStep.targetSelector)) {
                    goToNextStep();
                }
            }, OPTIONAL_TARGET_SKIP_DELAY)
            : undefined;

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.clearInterval(interval);
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('scroll', scheduleUpdate, true);
            if (optionalTargetTimer) {
                window.clearTimeout(optionalTargetTimer);
            }
        };
    }, [activeStep, goToNextStep, isActive, isMobile]);

    if (!isActive || !activeStep) {
        return null;
    }

    const isLastStep = stepIndex === steps.length - 1;
    const cardStyle = layout?.cardStyle ?? {
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        bottom: `calc(${VIEWPORT_MARGIN}px + env(safe-area-inset-bottom, 0px))`
    };

    return (
        <div className='pointer-events-none fixed inset-0 z-[260]' aria-live='polite'>
            {layout && (
                <div
                    className='fixed rounded-xl border border-[color-mix(in_srgb,var(--accent)_72%,white_12%)] shadow-[0_0_0_9999px_rgba(0,0,0,0.22),0_0_0_5px_color-mix(in_srgb,var(--accent)_20%,transparent),0_12px_34px_rgba(0,0,0,0.28)] transition-[top,left,width,height] duration-[180ms] ease-out-fluid max-md:rounded-xl max-md:shadow-[0_0_0_9999px_rgba(0,0,0,0.16),0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent),0_10px_28px_rgba(0,0,0,0.22)]'
                    style={layout.spotlightStyle}
                    aria-hidden='true'
                />
            )}

            <section
                className='pointer-events-auto fixed flex flex-col gap-2.5 rounded-xl border-0 bg-surface p-3.5 text-foreground shadow-[0_18px_48px_rgba(0,0,0,0.3)] max-md:max-w-[calc(100vw-1.5rem)] max-md:rounded-xl max-md:p-3'
                style={cardStyle}
                role='dialog'
                aria-label='Analysis discovery tutorial'
            >
                <div className='flex items-center justify-between gap-3'>
                    <span className='inline-flex min-h-[1.35rem] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 text-2xs font-semibold text-accent'>{stepIndex + 1} / {steps.length}</span>
                    <button
                        type='button'
                        className='inline-flex size-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:text-foreground focus-visible:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] focus-visible:text-foreground'
                        onClick={completeTour}
                        aria-label='Skip tutorial'
                        title='Skip tutorial'
                    >
                        <X size={13} aria-hidden='true' />
                    </button>
                </div>
                <h2 className='m-0 text-base font-semibold leading-[1.2] tracking-normal'>{activeStep.title}</h2>
                <p className='m-0 text-sm leading-[1.45] text-muted'>{activeStep.description}</p>
                <div className='flex items-center justify-end gap-2 pt-0.5'>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='text-muted'
                        onPress={completeTour}
                    >
                        Skip
                    </Button>
                    <Button
                        variant='secondary'
                        size='sm'
                        onPress={goToNextStep}
                    >
                        {isLastStep ? 'Done' : 'Next'}
                        {!isLastStep ? <ChevronRight size={13} /> : <Check size={13} />}
                    </Button>
                </div>
            </section>
        </div>
    );
};

export default CanvasAnalysisDiscoveryTour;
