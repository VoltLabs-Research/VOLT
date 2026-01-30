import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Stepper.css';

export interface Step<K extends string>{
    key: K;
    content: ReactNode;
};

export interface StepTitle{
    title: string;
    subtitle: string;
};

export type StepTitles<K extends string> = Record<K, StepTitle>;

type Direction = 'forward' | 'backward';

interface StepperProps<K extends string>{
    steps: Step<K>[];
    activeStep: K;
    className?: string;
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

const Stepper = <K extends string>({ steps, activeStep, className = '' }: StepperProps<K>) => {
    const [prevStep, setPrevStep] = useState<K>(activeStep);
    
    const currentIndex = steps.findIndex((step) => step.key === activeStep);
    const prevIndex = steps.findIndex((step) => step.key === prevStep);
    const direction: Direction = currentIndex >= prevIndex ? 'forward' : 'backward';

    if(activeStep !== prevStep){
        setPrevStep(activeStep);
    }

    const currentStep = steps.find((s) => s.key === activeStep);

    return (
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
};

export default Stepper;
