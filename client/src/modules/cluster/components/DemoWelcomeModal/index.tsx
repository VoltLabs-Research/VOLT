import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';
import { Button } from '@voltstack/bravais';
import './DemoWelcomeModal.css';
interface DemoLocationState {
    justProvisionedDemo?: boolean;
}

const STORAGE_KEY = 'demo-welcome-seen';

const formatRemaining = (expiresAt: Date | null): string => {
    if (!expiresAt) return 'a limited time';
    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) return 'a limited time';
    const remainingMinutes = Math.max(1, Math.round(remainingMs / 60_000));
    return `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
};

const buildSteps = (expiresAt: Date | null) => {
    const remaining = formatRemaining(expiresAt);

    return [
        {
            title: 'Welcome to Volt!',
            description: 'We spun up a temporary environment for you. You can explore the product without connecting your own cluster.'
        },
        {
            title: `${remaining} to explore`,
            description: `Your demo expires in ${remaining}. When it does, everything is cleaned up automatically and you can start fresh.`
        },
        {
            title: 'Some features are limited',
            description: 'Docker socket mounts and a few advanced options are disabled for safety. Connect your own cluster any time to unlock the full feature set.'
        },
        {
            title: 'Ready to try it?',
            description: 'Head back to the dashboard and give it a spin. When you want the full product, hit "Connect a Cluster" at the top.'
        }
    ];
};

const DemoWelcomeModal = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const expiresAt = useDemoClusterStore((state) => state.expiresAt);
    const steps = buildSteps(expiresAt);
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const state = location.state as DemoLocationState | null;
        if (state?.justProvisionedDemo !== true) return;

        const alreadySeen = localStorage.getItem(STORAGE_KEY) === '1';
        if (alreadySeen) {
            navigate(location.pathname, {
                replace: true,
                state: {}
            });
            return;
        }

        setIsOpen(true);
        setStepIndex(0);
    }, [location.state, location.pathname, navigate]);

    if (!isOpen) return null;

    const currentStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;

    const close = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setIsOpen(false);
        navigate(location.pathname, {
            replace: true,
            state: {}
        });
    };

    const goNext = () => {
        if (isLastStep) {
            close();
            return;
        }
        setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const goPrev = () => {
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    return (
        <div className='demo-welcome-modal-overlay' role='dialog' aria-modal='true' aria-labelledby='demo-welcome-title'>
            <div className='demo-welcome-modal-card'>
                <div className='flex flex-col gap-6'>
                    <div className='flex flex-col gap-2'>
                        <span className='text-xs text-muted'>Step {stepIndex + 1} of {steps.length}</span>
                        <h2 className='text-xl font-semibold text-foreground' id='demo-welcome-title'>
                            {currentStep.title}
                        </h2>
                        <span className='text-muted'>
                            {currentStep.description}
                        </span>
                    </div>

                    <div className='flex flex-row items-center justify-between'>
                        <Button variant='ghost' intent='neutral' onClick={close}>Skip</Button>
                        <div className='flex flex-row items-center gap-2'>
                            {stepIndex > 0 && (
                                <Button variant='outline' intent='neutral' onClick={goPrev}>Back</Button>
                            )}
                            <Button variant='solid' intent='brand' onClick={goNext}>
                                {isLastStep ? 'Got it' : 'Next'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoWelcomeModal;
