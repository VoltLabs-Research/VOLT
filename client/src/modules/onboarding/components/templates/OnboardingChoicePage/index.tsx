import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utilities/demo-feature';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import Box from '@/shared/presentation/primitives/Box';
import Heading from '@/shared/presentation/primitives/Heading';
import SelectableCard from '@/shared/presentation/primitives/SelectableCard';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { Plug, Zap } from 'lucide-react';
import './OnboardingChoicePage.css';

const OnboardingChoicePage = () => {
    const navigate = useNavigate();

    if (!isDemoClusterFeatureEnabled()) {
        return <Navigate to='/onboarding/cluster/setup' replace />;
    }

    const handleSignOut = () => {
        useAuthStore.getState().signOut();
    };

    const handleSettingsClick = () => {
        navigate('/dashboard/settings/general');
    };

    return (
        <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick}>
            <Stack gap='2' align='center' justify='center' textAlign='center' className='min-h-screen'>
                <Stack gap='1' align='center' textAlign='center'>
                    <Heading level={1} size='3xl' weight='bold'>
                        How would you like to start?
                    </Heading>
                    <Text tone='secondary'>
                        You can spin up a temporary demo environment instantly, or connect your own machine for a full setup.
                    </Text>
                </Stack>

                <Box className='onboarding-choice-options'>
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
                </Box>
            </Stack>
        </OnboardingLayout>
    );
};

export default OnboardingChoicePage;
