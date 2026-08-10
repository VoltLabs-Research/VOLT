import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utils/demo-feature';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { cn } from '@heroui/react';
import { Plug, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * bravais's `SelectableCard`, rebuilt from what it painted. It stays a plain
 * `<button>` rather than becoming a HeroUI `Button`: the chrome shares nothing with a
 * control (asymmetric 1.25rem/1rem padding, a card surface, its own 3px focus ring)
 * and a native button keeps the semantics and focusability for free.
 *
 * The one thing deliberately not carried over is `aria-pressed`. bravais emitted it
 * whenever no `selectionRole` was given, so both cards announced themselves as
 * unpressed toggle buttons — they navigate, and nothing here is ever selected.
 */
const CARD_CLASS_NAMES = [
    'relative flex flex-col items-center gap-3 px-4 py-5 text-center cursor-pointer',
    'rounded-2xl border border-border bg-surface-secondary',
    'transition-[border-color,box-shadow,transform,background-color] duration-150',
    'hover:border-border-secondary hover:bg-surface-tertiary',
    'focus-visible:outline-none focus-visible:border-focus',
    'focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_25%,transparent)]'
].join(' ');

/** `IconFrame` at `size='lg'` (a 56px square) — a tinted tile for a decorative glyph. */
const ICON_FRAME_CLASS_NAMES = 'inline-flex size-14 shrink-0 items-center justify-center rounded-xl';

const ICON_TONE_CLASS_NAMES = {
    brand: 'bg-info-soft border border-info/28 text-foreground',
    neutral: 'border border-border text-muted'
} as const;

interface OnboardingChoiceCardProps {
    title: string;
    description: string;
    icon: ReactNode;
    iconTone: keyof typeof ICON_TONE_CLASS_NAMES;
    onSelect: () => void;
};

const OnboardingChoiceCard = ({ title, description, icon, iconTone, onSelect }: OnboardingChoiceCardProps) => (
    <button type='button' className={CARD_CLASS_NAMES} onClick={onSelect}>
        <span className={cn(ICON_FRAME_CLASS_NAMES, ICON_TONE_CLASS_NAMES[iconTone])} aria-hidden='true'>
            {icon}
        </span>
        <h3 className='text-sm font-[550] text-foreground'>{title}</h3>
        <span className='text-xs text-muted leading-normal'>{description}</span>
    </button>
);

const OnboardingChoicePage = () => {
    const navigate = useNavigate();
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

    if (!isDemoClusterFeatureEnabled()) {
        return <Navigate to='/onboarding/cluster/setup' replace />;
    }

    return (
        <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick} isSigningOut={isSigningOut}>
            <div className='flex flex-col items-center justify-center gap-8 text-center min-h-screen'>
                <div className='flex flex-col items-center gap-4 text-center'>
                    <h1 className='text-3xl font-semibold text-foreground'>
                        How would you like to start?
                    </h1>
                    <span className='text-muted'>
                        You can spin up a temporary demo environment instantly, or connect your own machine for a full setup.
                    </span>
                </div>

                <div className='grid grid-cols-2 gap-4 w-[min(100%,560px)] max-[640px]:grid-cols-1'>
                    <OnboardingChoiceCard
                        title='Try Demo'
                        description='Spin up a ready-made environment in under a minute. 30-minute session. Some advanced options are limited.'
                        icon={<Zap size={20} />}
                        iconTone='brand'
                        onSelect={() => navigate('/onboarding/cluster/provisioning')}
                    />

                    <OnboardingChoiceCard
                        title='Connect a Cluster'
                        description='Pair your laptop or server with a one-line install script. Persistent storage, full feature set.'
                        icon={<Plug size={20} />}
                        iconTone='neutral'
                        onSelect={() => navigate('/onboarding/cluster/setup')}
                    />
                </div>
            </div>
        </OnboardingLayout>
    );
};

export default OnboardingChoicePage;
