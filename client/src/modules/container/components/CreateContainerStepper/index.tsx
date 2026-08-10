import { cn } from '@heroui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';

/**
 * bravais's `Stepper` in indicator mode — a vertical tablist beside an animated
 * panel — rebuilt here because HeroUI has no equivalent. The logic is bravais's,
 * unchanged; only the chrome moved from `Stepper.css` onto the elements.
 *
 * The behaviours that are easy to lose and are kept literally:
 *
 *   • **Arrow keys ACTIVATE, they do not merely move focus.** ArrowDown/Right go to
 *     the next navigable step, ArrowUp/Left to the previous, Home to the first and
 *     End to the last — each by calling `onStepClick`, and each skipping any step
 *     `canNavigateTo` rejects. The handler returns immediately unless both
 *     `indicators` and `onStepClick` are supplied.
 *   • **Direction is derived, never passed.** The previous step key is held in state
 *     and updated by an effect *after* the change, so the render that mounts the new
 *     panel still sees the old index and slides the right way. Ties count as
 *     forward.
 *   • **`indicators` and `steps` are independent arrays.** The number shown is the
 *     indicator's own index + 1, while "complete" is the step's position in `steps`
 *     against the active index.
 *   • **`AnimatePresence mode='wait'`** — the outgoing panel finishes exiting before
 *     the incoming one enters, so a step change takes ~0.5s at 0.25s each.
 *   • **The panel is always `tabIndex={0}`**, which is what keeps keyboard context
 *     across a step change.
 *
 * bravais's `className` prop is not reproduced: it went to the animated panel rather
 * than the container, which surprised every call site, and this module's only caller
 * never passed one.
 *
 * Class conversions worth naming: the indicator's `--radius-md` was bravais's 12px,
 * so `rounded-xl`; the active number's `background: var(--accent-blue)` is
 * `bg-accent`, and its hardcoded `color: var(--color-surface-1)` becomes
 * `text-accent-foreground`, which is the token that actually tracks the accent in
 * both themes.
 */
export interface StepperStep<K extends string> {
    key: K;
    content: ReactNode;
}

export interface StepperIndicator<K extends string> {
    key: K;
    label: string;
    description?: string;
}

interface CreateContainerStepperProps<K extends string> {
    steps: StepperStep<K>[];
    activeStep: K;
    indicators: StepperIndicator<K>[];
    onStepClick?: (key: K) => void;
    canNavigateTo?: (key: K) => boolean;
}

type StepDirection = 'forward' | 'backward';

const ROOT_CLASS_NAMES = 'flex h-full flex-1 overflow-hidden max-[900px]:flex-col';
const SIDEBAR_CLASS_NAMES = 'flex w-[260px] shrink-0 flex-col gap-2 border-r border-border p-5 max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:p-4';
const INDICATOR_CLASS_NAMES = 'flex w-full min-h-10 flex-row items-center gap-1 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-left text-inherit opacity-50 transition-[opacity,background-color] duration-200 ease-out disabled:cursor-not-allowed focus-visible:border-[var(--focus)] focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)] focus-visible:outline-none';
const INDICATOR_ACTIVE_CLASS_NAMES = 'bg-surface-tertiary opacity-100';
const INDICATOR_COMPLETE_CLASS_NAMES = 'opacity-80';
const NUMBER_CLASS_NAMES = 'flex size-[26px] shrink-0 items-center justify-center rounded-full bg-border text-[0.8125rem] font-semibold text-muted transition-[background-color,color] duration-200 ease-out';
const NUMBER_ACTIVE_CLASS_NAMES = 'bg-accent text-accent-foreground';
const LINE_CLASS_NAMES = 'ml-5 h-[18px] w-0.5 bg-border transition-[background-color] duration-200';
const LINE_ACTIVE_CLASS_NAMES = 'bg-accent';
const CONTENT_CLASS_NAMES = 'max-w-[900px] flex-1 overflow-y-auto px-12 py-8 max-[900px]:max-w-none max-[900px]:p-6';
const PANEL_CLASS_NAMES = 'w-full [will-change:opacity,transform]';

const STEP_VARIANTS = {
    enter: (direction: StepDirection) => ({
        x: direction === 'forward' ? 20 : -20,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: StepDirection) => ({
        x: direction === 'forward' ? -20 : 20,
        opacity: 0
    })
};

const REDUCED_MOTION_STEP_VARIANTS = {
    enter: {
        x: 0,
        opacity: 0
    },
    center: {
        x: 0,
        opacity: 1
    },
    exit: {
        x: 0,
        opacity: 0
    }
};

const CreateContainerStepper = <K extends string>({
    steps,
    activeStep,
    indicators,
    onStepClick,
    canNavigateTo
}: CreateContainerStepperProps<K>) => {
    const uid = useId();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [previousStep, setPreviousStep] = useState<K>(activeStep);

    useEffect(() => {
        setPreviousStep(activeStep);
    }, [activeStep]);

    const currentIndex = steps.findIndex((step) => step.key === activeStep);
    const previousIndex = steps.findIndex((step) => step.key === previousStep);
    const direction: StepDirection = currentIndex >= previousIndex ? 'forward' : 'backward';
    const currentStep = steps.find((step) => step.key === activeStep);

    const isNavigable = (key: K) => canNavigateTo?.(key) ?? true;

    const handleIndicatorClick = (key: K) => {
        if (!isNavigable(key)) {
            return;
        }

        onStepClick?.(key);
    };

    /**
     * Walks from `from` in `step` direction until it finds an indicator
     * `canNavigateTo` accepts, exactly as bravais's `getNavigableIndex` did — so a
     * blocked step is skipped over rather than stopping the traversal.
     */
    const getNavigableIndex = (from: number, step: 1 | -1): number => {
        let index = from;

        while (index >= 0 && index < indicators.length) {
            if (isNavigable(indicators[index].key)) {
                return index;
            }

            index += step;
        }

        return -1;
    };

    const handleIndicatorKeyDown = (event: KeyboardEvent<HTMLButtonElement>, indicatorIndex: number) => {
        if (!onStepClick) {
            return;
        }

        let nextIndex = -1;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextIndex = getNavigableIndex(indicatorIndex + 1, 1);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextIndex = getNavigableIndex(indicatorIndex - 1, -1);
        } else if (event.key === 'Home') {
            nextIndex = getNavigableIndex(0, 1);
        } else if (event.key === 'End') {
            nextIndex = getNavigableIndex(indicators.length - 1, -1);
        } else {
            return;
        }

        event.preventDefault();

        if (nextIndex === -1) {
            return;
        }

        handleIndicatorClick(indicators[nextIndex].key);
    };

    const panel = (
        <AnimatePresence mode='wait' custom={direction} initial={false}>
            <motion.div
                key={activeStep}
                custom={direction}
                variants={prefersReducedMotion ? REDUCED_MOTION_STEP_VARIANTS : STEP_VARIANTS}
                initial='enter'
                animate='center'
                exit='exit'
                transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                className={PANEL_CLASS_NAMES}
                id={`${uid}-${activeStep}-panel`}
                role='tabpanel'
                aria-labelledby={`${uid}-${activeStep}-tab`}
                tabIndex={0}
            >
                {currentStep?.content}
            </motion.div>
        </AnimatePresence>
    );

    return (
        <div className={ROOT_CLASS_NAMES}>
            <div className={SIDEBAR_CLASS_NAMES} role='tablist' aria-orientation='vertical'>
                {indicators.map((indicator, indicatorIndex) => {
                    const isActive = indicator.key === activeStep;
                    const isComplete = steps.findIndex((step) => step.key === indicator.key) < currentIndex;
                    const isClickable = isNavigable(indicator.key);

                    return (
                        <div key={indicator.key}>
                            <button
                                id={`${uid}-${indicator.key}-tab`}
                                type='button'
                                role='tab'
                                aria-selected={isActive}
                                aria-controls={`${uid}-${indicator.key}-panel`}
                                tabIndex={isActive ? 0 : -1}
                                className={cn(
                                    INDICATOR_CLASS_NAMES,
                                    isActive && INDICATOR_ACTIVE_CLASS_NAMES,
                                    isComplete && INDICATOR_COMPLETE_CLASS_NAMES,
                                    isClickable && onStepClick && 'cursor-pointer'
                                )}
                                disabled={!isClickable || !onStepClick}
                                onClick={() => handleIndicatorClick(indicator.key)}
                                onKeyDown={(event) => handleIndicatorKeyDown(event, indicatorIndex)}
                            >
                                <div className={cn(NUMBER_CLASS_NAMES, isActive && NUMBER_ACTIVE_CLASS_NAMES)}>
                                    {indicatorIndex + 1}
                                </div>
                                <div className='flex flex-col gap-1'>
                                    <span className='text-sm font-semibold'>{indicator.label}</span>
                                    {indicator.description && (
                                        <small className='text-[0.7125rem] text-muted'>{indicator.description}</small>
                                    )}
                                </div>
                            </button>
                            {indicatorIndex < indicators.length - 1 && (
                                <div className={cn(LINE_CLASS_NAMES, indicatorIndex < currentIndex && LINE_ACTIVE_CLASS_NAMES)} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className={CONTENT_CLASS_NAMES}>
                {panel}
            </div>
        </div>
    );
};

export default CreateContainerStepper;
