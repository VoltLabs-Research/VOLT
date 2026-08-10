import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';
import { Button } from '@heroui/react';

interface DemoLocationState {
    justProvisionedDemo?: boolean;
}

/**
 * The deleted sheet's two rules.
 *
 * This overlay is hand-rolled — a `role='dialog'` div with its own backdrop, its own
 * `useState`, and no Escape or outside-press handling — and is left that way rather
 * than moved onto `@/shared/ui/modal`: it never went through bravais's modal, so
 * there is no bravais call site to convert, and adopting the store would add a focus
 * trap, a portal, and two dismissal paths that have to run `close()` (localStorage +
 * a `navigate` that clears the router state) to stay correct. That is a redesign,
 * not a re-skin.
 *
 * One live bug is fixed rather than preserved: the card's fill was
 * `var(--surface-1, #ffffff)`, and `--surface-1` has never been a declared token —
 * only `--color-surface-1` ever was — so the card fell through to literal white
 * while its text stayed `var(--foreground)`. In dark mode that was near-white on
 * white. `bg-surface` is the value the CSS inventory assigns it, and it themes.
 *
 * `border-radius: 16px` is bravais's `rounded-lg`, which is HeroUI's `rounded-2xl`
 * (spec §3b) — the one mapping that must never be left alone.
 */
const OVERLAY_CLASS = 'fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4';

const CARD_CLASS = 'w-full max-w-[480px] rounded-2xl bg-surface p-7 text-foreground shadow-[0_30px_60px_rgba(0,0,0,0.2)]';

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
        <div className={OVERLAY_CLASS} role='dialog' aria-modal='true' aria-labelledby='demo-welcome-title'>
            <div className={CARD_CLASS}>
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
                        <Button variant='ghost' onPress={close}>Skip</Button>
                        <div className='flex flex-row items-center gap-2'>
                            {stepIndex > 0 && (
                                <Button variant='outline' onPress={goPrev}>Back</Button>
                            )}
                            <Button variant='primary' onPress={goNext}>
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
