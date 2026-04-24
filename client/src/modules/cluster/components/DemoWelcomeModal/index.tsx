import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Heading, Row, Stack, Text } from '@/shared/presentation/primitives';
import './DemoWelcomeModal.css';
interface DemoLocationState {
    justProvisionedDemo?: boolean;
};

const STORAGE_KEY = 'demo-welcome-seen';

interface Step {
    title: string;
    description: string;
};

const STEPS: Step[] = [
    {
        title: 'Welcome to Volt!',
        description: 'We spun up a temporary environment for you. You can explore the product without connecting your own cluster.'
    },
    {
        title: '30 minutes to explore',
        description: 'Your demo expires in 30 minutes. When it does, everything is cleaned up automatically and you can start fresh.'
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

const isDemoLocationState = (state: unknown): state is DemoLocationState => {
    return typeof state === 'object' && state !== null && 'justProvisionedDemo' in state;
};

const DemoWelcomeModal = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const state = location.state;
        const justProvisioned = isDemoLocationState(state) && state.justProvisionedDemo === true;
        if (!justProvisioned) return;

        const alreadySeen = localStorage.getItem(STORAGE_KEY) === '1';
        if (alreadySeen) {
            navigate(location.pathname, { replace: true, state: {} });
            return;
        }

        setIsOpen(true);
        setStepIndex(0);
    }, [location.state, location.pathname, navigate]);

    if (!isOpen) return null;

    const currentStep = STEPS[stepIndex];
    const isLastStep = stepIndex === STEPS.length - 1;

    const close = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setIsOpen(false);
        navigate(location.pathname, { replace: true, state: {} });
    };

    const goNext = () => {
        if (isLastStep) {
            close();
            return;
        }
        setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    };

    const goPrev = () => {
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    return (
        <div className='demo-welcome-modal-overlay' role='dialog' aria-modal='true' aria-labelledby='demo-welcome-title'>
            <div className='demo-welcome-modal-card'>
                <Stack gap='1-5'>
                    <Stack gap='05'>
                        <Text size='sm' tone='muted'>Step {stepIndex + 1} of {STEPS.length}</Text>
                        <Heading id='demo-welcome-title' level={2} size='xl' weight='bold'>
                            {currentStep.title}
                        </Heading>
                        <Text tone='secondary'>
                            {currentStep.description}
                        </Text>
                    </Stack>

                    <Row justify='between' align='center'>
                        <Button variant='ghost' intent='neutral' onClick={close}>Skip</Button>
                        <Row gap='05'>
                            {stepIndex > 0 && (
                                <Button variant='outline' intent='neutral' onClick={goPrev}>Back</Button>
                            )}
                            <Button variant='solid' intent='brand' onClick={goNext}>
                                {isLastStep ? 'Got it' : 'Next'}
                            </Button>
                        </Row>
                    </Row>
                </Stack>
            </div>
        </div>
    );
};

export default DemoWelcomeModal;
