import { useState, useCallback } from 'react';

const useStepper = <K extends string>(initialStep: K) => {
    const [step, setStep] = useState<K>(initialStep);

    const goTo = useCallback((next: K) => setStep(next), []);
    const reset = useCallback(() => setStep(initialStep), [initialStep]);

    return { step, goTo, reset };
};

export default useStepper;
