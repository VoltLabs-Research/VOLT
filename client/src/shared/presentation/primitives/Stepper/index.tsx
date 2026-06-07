import './Stepper.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactElement, Ref } from 'react';
import type { ReactNode } from 'react';

export interface Step<K extends string>{
    key: K;
    content: ReactNode;
};

interface StepTitle{
    title: string;
    subtitle: string;
};

export type StepTitles<K extends string> = Record<K, StepTitle>;

export interface StepIndicator<K extends string>{
    key: K;
    label: string;
    description?: string;
};

type Direction = 'forward' | 'backward';

interface StepperProps<K extends string>{
    steps: Step<K>[];
    activeStep: K;
    className?: string;
    indicators?: StepIndicator<K>[];
    onStepClick?: (key: K) => void;
    canNavigateTo?: (key: K) => boolean;
};

const variants = {
    enter: (direction: Direction) => ({
        x: direction === 'forward' ? 20 : -20,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: Direction) => ({
        x: direction === 'forward' ? -20 : 20,
        opacity: 0
    })
};

const reducedMotionVariants = {
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

const Stepper = forwardRef(function Stepper<K extends string>({
    steps,
    activeStep,
    className = '',
    indicators,
    onStepClick,
    canNavigateTo
}: StepperProps<K>, ref: Ref<HTMLDivElement>) {
    const [prevStep, setPrevStep] = useState<K>(activeStep);
    const prefersReducedMotion = usePrefersReducedMotion();
    const stepperId = useId();
    const stepIndicators = indicators ?? [];
    const stepVariants = prefersReducedMotion ? reducedMotionVariants : variants;
    
    const currentIndex = steps.findIndex((step) => step.key === activeStep);
    const prevIndex = steps.findIndex((step) => step.key === prevStep);
    const direction: Direction = currentIndex >= prevIndex ? 'forward' : 'backward';

    useEffect(() => {
        if (activeStep !== prevStep) {
            setPrevStep(activeStep);
        }
    }, [activeStep, prevStep]);

    const currentStep = steps.find((state) => state.key === activeStep);
    const activePanelId = `${stepperId}-${activeStep}-panel`;

    const handleIndicatorClick = (key: K) => {
        if(!onStepClick) return;
        if(canNavigateTo && !canNavigateTo(key)) return;
        onStepClick(key);
    };

    const getNavigableIndex = (startIndex: number, increment: number) => {
        let nextIndex = startIndex;

        while (nextIndex >= 0 && nextIndex < stepIndicators.length) {
            const nextIndicator = stepIndicators[nextIndex];
            if (!nextIndicator) {
                return null;
            }

            if (!canNavigateTo || canNavigateTo(nextIndicator.key)) {
                return nextIndex;
            }

            nextIndex += increment;
        }

        return null;
    };

    const handleIndicatorKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (!indicators || !onStepClick) {
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            const nextIndex = getNavigableIndex(index + 1, 1);
            if (nextIndex !== null) {
                handleIndicatorClick(stepIndicators[nextIndex].key);
            }
            return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const nextIndex = getNavigableIndex(index - 1, -1);
            if (nextIndex !== null) {
                handleIndicatorClick(stepIndicators[nextIndex].key);
            }
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            const nextIndex = getNavigableIndex(0, 1);
            if (nextIndex !== null) {
                handleIndicatorClick(stepIndicators[nextIndex].key);
            }
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            const nextIndex = getNavigableIndex(stepIndicators.length - 1, -1);
            if (nextIndex !== null) {
                handleIndicatorClick(stepIndicators[nextIndex].key);
            }
        }
    };

    const renderStepContent = () => (
        <AnimatePresence 
            mode='wait' 
            custom={direction} 
            initial={false}>
            <motion.div
                key={activeStep}
                custom={direction}
                variants={stepVariants}
                initial='enter'
                animate='center'
                exit='exit'
                transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                className={`stepper-step ${className}`}
                id={activePanelId}
                role={indicators ? 'tabpanel' : undefined}
                aria-labelledby={indicators ? `${stepperId}-${activeStep}-tab` : undefined}
                tabIndex={0}>
                {currentStep?.content}
            </motion.div>
        </AnimatePresence>
    );

    if(!indicators){
        return (
            <div ref={ref} className='stepper-standalone'>
                {renderStepContent()}
            </div>
        );
    }

    return (
        <div ref={ref} className='stepper-with-sidebar d-flex overflow-hidden flex-1'>
            <div className='stepper-sidebar d-flex column gap-05' role='tablist' aria-orientation='vertical'>
                {stepIndicators.map((indicator, index) => {
                    const indicatorIndex = steps.findIndex((s) => s.key === indicator.key);
                    const isActive = indicator.key === activeStep;
                    const isComplete = indicatorIndex < currentIndex;
                    const isClickable = !canNavigateTo || canNavigateTo(indicator.key);
                    const tabId = `${stepperId}-${indicator.key}-tab`;
                    const panelId = `${stepperId}-${indicator.key}-panel`;
                    
                    return (
                        <div className="" key={indicator.key}>
                            <button
                                id={tabId}
                                type='button'
                                role='tab'
                                aria-selected={isActive}
                                aria-controls={panelId}
                                tabIndex={isActive ? 0 : -1}
                                className={`stepper-indicator d-flex items-center gap-1 ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''} ${isClickable && onStepClick ? 'cursor-pointer' : ''}`}
                                disabled={!isClickable || !onStepClick}
                                onClick={() => handleIndicatorClick(indicator.key)}
                                onKeyDown={(event) => handleIndicatorKeyDown(event, index)}
                            >
                                <div className='stepper-indicator-number d-flex flex-center font-weight-6'>
                                    {index + 1}
                                </div>
                                <div className='stepper-indicator-label d-flex column gap-025'>
                                    <span className='stepper-indicator-title'>{indicator.label}</span>
                                    {indicator.description && (
                                        <small className='stepper-indicator-desc'>{indicator.description}</small>
                                    )}
                                </div>
                            </button>
                            {index < stepIndicators.length - 1 && (
                                <div className={`stepper-line ${indicatorIndex < currentIndex ? 'active' : ''}`} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className='stepper-content y-auto flex-1'>
                {renderStepContent()}
            </div>
        </div>
    );
}) as <K extends string>(props: StepperProps<K> & { ref?: Ref<HTMLDivElement> }) => ReactElement;

(Stepper as { displayName?: string }).displayName = 'Stepper';

export default Stepper;
