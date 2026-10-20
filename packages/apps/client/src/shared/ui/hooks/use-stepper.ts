import { useState } from 'react';

export const useStepper = <K extends string>(initialStep: K) => {
    const [step, setStep] = useState<K>(initialStep);

    return { step, goTo: setStep };
};
