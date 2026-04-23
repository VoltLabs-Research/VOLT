import { useState, useCallback, useMemo } from 'react';

interface UseStepperOptions<K extends string>{
    steps: K[];
};

const useStepper = <K extends string>(initialStep: K, options?: UseStepperOptions<K>) => {
    const [step, setStep] = useState<K>(initialStep);
    const steps = options?.steps;

    const goTo = useCallback((next: K) => setStep(next), []);
    const reset = useCallback(() => setStep(initialStep), [initialStep]);

    const currentIndex = useMemo(() => {
        if(!steps) return -1;
        return steps.indexOf(step);
    }, [steps, step]);

    const next = useCallback(() => {
        if(!steps || currentIndex === -1 || currentIndex >= steps.length - 1) return;
        setStep(steps[currentIndex + 1]);
    }, [steps, currentIndex]);

    const prev = useCallback(() => {
        if(!steps || currentIndex <= 0) return;
        setStep(steps[currentIndex - 1]);
    }, [steps, currentIndex]);

    const isFirst = currentIndex === 0;
    const isLast = steps ? currentIndex === steps.length - 1 : false;

    return { step, goTo, reset, next, prev, currentIndex, isFirst, isLast };
};

export default useStepper;
