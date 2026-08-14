import { cn } from '@heroui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import Scrollable from '@/shared/ui/components/Scrollable';

interface StepperStep<K extends string> {
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
                className='w-full [will-change:opacity,transform]'
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
        <div className='flex h-full flex-1 overflow-hidden max-[900px]:flex-col'>
            <div className='flex w-[260px] shrink-0 flex-col gap-2 border-r border-border p-5 max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:p-4' role='tablist' aria-orientation='vertical'>
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
                                    'flex w-full min-h-10 flex-row items-center gap-1 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-left text-inherit opacity-50 transition-[opacity,background-color] duration-200 ease-out disabled:cursor-not-allowed focus-visible:border-[var(--focus)] focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)] focus-visible:outline-none',
                                    isActive && 'bg-surface-tertiary opacity-100',
                                    isComplete && 'opacity-80',
                                    isClickable && onStepClick && 'cursor-pointer'
                                )}
                                disabled={!isClickable || !onStepClick}
                                onClick={() => handleIndicatorClick(indicator.key)}
                                onKeyDown={(event) => handleIndicatorKeyDown(event, indicatorIndex)}
                            >
                                <div className={cn('flex size-[26px] shrink-0 items-center justify-center rounded-full bg-border text-sm font-semibold text-muted transition-[background-color,color] duration-200 ease-out', isActive && 'bg-accent text-accent-foreground')}>
                                    {indicatorIndex + 1}
                                </div>
                                <div className='flex flex-col gap-1'>
                                    <span className='text-sm font-semibold'>{indicator.label}</span>
                                    {indicator.description && (
                                        <small className='text-2xs text-muted'>{indicator.description}</small>
                                    )}
                                </div>
                            </button>
                            {indicatorIndex < indicators.length - 1 && (
                                <div className={cn('ml-5 h-[18px] w-0.5 bg-border transition-[background-color] duration-200', indicatorIndex < currentIndex && 'bg-accent')} />
                            )}
                        </div>
                    );
                })}
            </div>
            <Scrollable className='max-w-[900px] flex-1 px-12 py-8 max-[900px]:max-w-none max-[900px]:p-6'>
                {panel}
            </Scrollable>
        </div>
    );
};

export default CreateContainerStepper;
