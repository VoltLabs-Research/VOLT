import Button from '@/shared/presentation/primitives/Button';
import { Check, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './CanvasAnalysisDiscoveryTour.css';

const TOUR_STORAGE_KEY_PREFIX = 'volt:tutorial:canvas-analysis-discovery:v1';
const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';
const TOUR_SELECT_EXPOSURE_EVENT = 'canvas-analysis-tour:select-first-exposure';
const TOUR_SELECT_TIMELINE_TAB_EVENT = 'canvas-analysis-tour:select-timeline-tab';
const TARGET_GAP = 12;
const VIEWPORT_MARGIN = 12;
const CARD_ESTIMATED_HEIGHT = 146;

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
    missingTargetSkipDelay?: number;
}

interface TargetLayout {
    spotlightStyle: CSSProperties;
    cardStyle: CSSProperties;
}

const getStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage;
};

const getTourStorageKey = (storageScopeId: string): string => {
    return `${TOUR_STORAGE_KEY_PREFIX}:${storageScopeId}`;
};

const hasCompletedTour = (storageScopeId: string): boolean => {
    const storage = getStorage();
    if (!storage) return false;

    try {
        return storage.getItem(getTourStorageKey(storageScopeId)) === 'completed';
    } catch {
        return false;
    }
};

const markTourCompleted = (storageScopeId: string): void => {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.setItem(getTourStorageKey(storageScopeId), 'completed');
    } catch {
        // Storage can be unavailable in private contexts; the tour still works for this session.
    }
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

const getTargetElement = (selector: string): HTMLElement | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    return document.querySelector<HTMLElement>(selector);
};

const dispatchAutoAction = (action: 'select-analysis' | 'select-exposure'): void => {
    if (typeof window === 'undefined') {
        return;
    }

    if (action === 'select-analysis') {
        window.dispatchEvent(new CustomEvent(TOUR_SELECT_ANALYSIS_EVENT));
    } else if (action === 'select-exposure') {
        window.dispatchEvent(new CustomEvent(TOUR_SELECT_EXPOSURE_EVENT));
    }
};

const dispatchTimelineTabSelection = (): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(TOUR_SELECT_TIMELINE_TAB_EVENT));
};

const buildSteps = (isMobile: boolean): TourStep[] => {
    const sharedSteps: TourStep[] = [{
        id: 'analysis-section',
        title: 'Analysis panel',
        description: 'This panel lists the analysis results available for the trajectory. A result is opened automatically so you can inspect it right away.',
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
    const left = clamp(targetCenter - cardWidth / 2, VIEWPORT_MARGIN, maxLeft);
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
    }, [isActive, onActiveChange]);

    useEffect(() => {
        return () => {
            onActiveChange?.(false);
        };
    }, [onActiveChange]);

    const goToNextStep = useCallback(() => {
        if (stepIndex >= steps.length - 1) {
            completeTour();
            return;
        }

        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }, [completeTour, stepIndex, steps.length]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        if (hasStartedRef.current || hasCompletedTour(storageScopeId)) {
            return;
        }

        const timer = window.setTimeout(() => {
            if (hasCompletedTour(storageScopeId)) {
                return;
            }

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
        const maxAttempts = 24;

        const runAutoAction = () => {
            dispatchAutoAction('select-analysis');
            if (attempts >= 2) {
                dispatchAutoAction('select-exposure');
            }
            attempts += 1;

            const selectedExposure = getTargetElement('[data-tour-id="canvas-first-exposure-row"]');
            if (selectedExposure?.getAttribute('aria-selected') === 'true' || attempts >= maxAttempts) {
                completedPanelAutoSelectRef.current = true;
                return true;
            }

            return false;
        };

        const timer = window.setInterval(() => {
            if (runAutoAction()) {
                window.clearInterval(timer);
            }
        }, 160);

        return () => window.clearInterval(timer);
    }, [activeStep, isActive]);

    useEffect(() => {
        if (!isActive || !activeStep?.requiresTimelineTab) {
            return;
        }

        let attempts = 0;
        const maxAttempts = 16;
        const timer = window.setInterval(() => {
            dispatchTimelineTabSelection();
            attempts += 1;

            if (getTargetElement(activeStep.targetSelector) || attempts >= maxAttempts) {
                window.clearInterval(timer);
            }
        }, 120);

        dispatchTimelineTabSelection();

        return () => window.clearInterval(timer);
    }, [activeStep, isActive]);

    useEffect(() => {
        if (!isActive || !activeStep) {
            setLayout(null);
            return;
        }

        let frameId = 0;

        const updateLayout = () => {
            const target = getTargetElement(activeStep.targetSelector);
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
                if (!getTargetElement(activeStep.targetSelector)) {
                    goToNextStep();
                }
            }, activeStep.missingTargetSkipDelay ?? 360)
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

    const progressLabel = `${stepIndex + 1} / ${steps.length}`;
    const isLastStep = stepIndex === steps.length - 1;
    const cardStyle = layout?.cardStyle ?? {
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        bottom: `calc(${VIEWPORT_MARGIN}px + env(safe-area-inset-bottom, 0px))`
    };

    return (
        <div className='canvas-analysis-tour' aria-live='polite'>
            {layout && (
                <div
                    className='canvas-analysis-tour__spotlight'
                    style={layout.spotlightStyle}
                    aria-hidden='true'
                />
            )}

            <section
                className='canvas-analysis-tour__card canvas-overlay-glass'
                style={cardStyle}
                role='dialog'
                aria-label='Analysis discovery tutorial'
            >
                <div className='canvas-analysis-tour__header'>
                    <span className='canvas-analysis-tour__step'>{progressLabel}</span>
                    <button
                        type='button'
                        className='canvas-analysis-tour__close'
                        onClick={completeTour}
                        aria-label='Skip tutorial'
                        title='Skip tutorial'
                    >
                        <X size={13} aria-hidden='true' />
                    </button>
                </div>
                <h2 className='canvas-analysis-tour__title'>{activeStep.title}</h2>
                <p className='canvas-analysis-tour__description'>{activeStep.description}</p>
                <div className='canvas-analysis-tour__actions'>
                    <Button
                        variant='ghost'
                        intent='canvas'
                        size='sm'
                        shape='rounded'
                        className='canvas-analysis-tour__skip'
                        onClick={completeTour}
                    >
                        Skip
                    </Button>
                    <Button
                        variant='solid'
                        intent='canvas'
                        size='sm'
                        shape='rounded'
                        rightIcon={!isLastStep ? <ChevronRight size={13} /> : <Check size={13} />}
                        onClick={goToNextStep}
                    >
                        {isLastStep ? 'Done' : 'Next'}
                    </Button>
                </div>
            </section>
        </div>
    );
};

export default CanvasAnalysisDiscoveryTour;
