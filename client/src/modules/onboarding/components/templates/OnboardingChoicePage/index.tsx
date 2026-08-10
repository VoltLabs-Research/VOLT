import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utils/demo-feature';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { SelectableCard } from '@voltstack/bravais';
import { Plug, Zap } from 'lucide-react';
import './OnboardingChoicePage.css';

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

                <div className='onboarding-choice-options'>
                    <SelectableCard
                        title='Try Demo'
                        description='Spin up a ready-made environment in under a minute. 30-minute session. Some advanced options are limited.'
                        icon={<Zap size={20} />}
                        iconTone='brand'
                        onSelect={() => navigate('/onboarding/cluster/provisioning')}
                    />

                    <SelectableCard
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
