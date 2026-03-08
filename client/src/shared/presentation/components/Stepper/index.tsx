import Container from '../Container';
import './Stepper.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState } from 'react';

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

const Stepper = <K extends string>({ 
    steps, 
    activeStep, 
    className = '',
    indicators,
    onStepClick,
    canNavigateTo
}: StepperProps<K>) => {
    const [prevStep, setPrevStep] = useState<K>(activeStep);
    
    const currentIndex = steps.findIndex((step) => step.key === activeStep);
    const prevIndex = steps.findIndex((step) => step.key === prevStep);
    const direction: Direction = currentIndex >= prevIndex ? 'forward' : 'backward';

    if(activeStep !== prevStep){
        setPrevStep(activeStep);
    }

    const currentStep = steps.find((state) => state.key === activeStep);

    const handleIndicatorClick = (key: K) => {
        if(!onStepClick) return;
        if(canNavigateTo && !canNavigateTo(key)) return;
        onStepClick(key);
    };

    const renderStepContent = () => (
        <AnimatePresence 
            mode='wait' 
            custom={direction} 
            initial={false}>
            <motion.div
                key={activeStep}
                custom={direction}
                variants={variants}
                initial='enter'
                animate='center'
                exit='exit'
                transition={{ duration: 0.25 }}
                className={`stepper-step ${className}`}>
                {currentStep?.content}
            </motion.div>
        </AnimatePresence>
    );

    if(!indicators){
        return renderStepContent();
    }

    return (
        <Container className='stepper-with-sidebar d-flex overflow-hidden flex-1'>
            <Container className='stepper-sidebar d-flex column gap-05'>
                {indicators.map((indicator, index) => {
                    const indicatorIndex = steps.findIndex((s) => s.key === indicator.key);
                    const isActive = indicatorIndex <= currentIndex;
                    const isClickable = !canNavigateTo || canNavigateTo(indicator.key);
                    
                    return (
                        <Container key={indicator.key}>
                            <Container
                                className={`stepper-indicator d-flex items-center gap-1 ${isActive ? 'active' : ''} ${isClickable && onStepClick ? 'cursor-pointer' : ''}`}
                                onClick={() => handleIndicatorClick(indicator.key)}
                            >
                                <Container className='stepper-indicator-number d-flex flex-center font-weight-6'>
                                    {index + 1}
                                </Container>
                                <Container className='stepper-indicator-label d-flex column gap-025'>
                                    <span className='stepper-indicator-title'>{indicator.label}</span>
                                    {indicator.description && (
                                        <small className='stepper-indicator-desc'>{indicator.description}</small>
                                    )}
                                </Container>
                            </Container>
                            {index < indicators.length - 1 && (
                                <Container className={`stepper-line ${indicatorIndex < currentIndex ? 'active' : ''}`} />
                            )}
                        </Container>
                    );
                })}
            </Container>
            <Container className='stepper-content y-auto flex-1'>
                {renderStepContent()}
            </Container>
        </Container>
    );
};

export default Stepper;
