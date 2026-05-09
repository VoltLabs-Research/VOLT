import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { hasUsableTeamCluster } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utilities/demo-feature';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';
import {
    useProvisionDemoTeamClusterMutation,
    useTeamClustersQuery
} from '@/modules/cluster/hooks/team-cluster/queries';
import { sileo } from 'sileo';
import { reportError, ErrorSurface } from '@/shared/errors/core';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

const DemoProvisioningPage = () => {
    const navigate = useNavigate();
    const user = useCurrentUser();
    const selectedTeamId = useSelectedTeamId();
    const setFromCluster = useDemoClusterStore((state) => state.setFromCluster);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

    const [hasTriggered, setHasTriggered] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const startedAtRef = useRef<number | null>(null);

    const provisionDemo = useProvisionDemoTeamClusterMutation();

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId) && isWaiting,
        refetchInterval: isWaiting ? POLL_INTERVAL_MS : false,
        staleTime: 0
    });

    useEffect(() => {
        if (!user || !selectedTeamId || hasTriggered) {
            return;
        }
        setHasTriggered(true);
        startedAtRef.current = Date.now();
        setIsWaiting(true);

        provisionDemo.mutate(
            { teamId: selectedTeamId },
            {
                onSuccess: (data) => {
                    setFromCluster(data.teamCluster);
                },
                onError: (error) => {
                    setIsWaiting(false);
                    setHasFailed(true);
                    reportError(error, {
                        surface: ErrorSurface.Toast,
                        fallbackTitle: 'Demo provisioning failed',
                        fallbackDescription: 'Could not provision a demo cluster. Connect your own cluster to continue.'
                    });
                }
            }
        );
    }, [user, selectedTeamId, hasTriggered, provisionDemo, setFromCluster]);

    useEffect(() => {
        if (!isWaiting) return;
        const started = startedAtRef.current ?? Date.now();
        if (Date.now() - started > POLL_TIMEOUT_MS) {
            setIsWaiting(false);
            setHasFailed(true);
            sileo.error({
                title: 'Provisioning timed out',
                description: 'Please try again or connect your own cluster.'
            });
            return;
        }

        if (teamClustersQuery.isSuccess && hasUsableTeamCluster(teamClustersQuery.data.data)) {
            const activeDemo = teamClustersQuery.data.data.find((cluster) => cluster.isDemo);
            if (activeDemo) {
                setFromCluster(activeDemo);
            }
            setIsWaiting(false);
            navigate('/dashboard', {
                state: { justProvisionedDemo: true },
                replace: true
            });
        }
    }, [isWaiting, teamClustersQuery.data, teamClustersQuery.isSuccess, navigate, setFromCluster]);

    if (!isDemoClusterFeatureEnabled()) {
        return <Navigate to='/onboarding/cluster/setup' replace />;
    }

    if (hasFailed) {
        return (
            <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick} isSigningOut={isSigningOut}>
                <Stack gap='2' align='center' justify='center' textAlign='center'>
                    <Heading level={1} size='2xl' weight='bold'>Demo provisioning failed</Heading>
                    <Text tone='secondary'>
                        We couldn&apos;t spin up a demo cluster. You can retry, or connect your own cluster.
                    </Text>
                    <Row gap='1'>
                        <Button variant='solid' intent='brand' onClick={() => {
                            setHasFailed(false);
                            setHasTriggered(false);
                        }}>Retry</Button>
                        <Button variant='outline' intent='neutral' onClick={() => navigate('/onboarding/cluster/setup')}>
                            Connect a Cluster
                        </Button>
                    </Row>
                </Stack>
            </OnboardingLayout>
        );
    }

    return (
        <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick} isSigningOut={isSigningOut}>
            <Stack align='center' justify='center' gap='1-5' className='min-h-screen'>
                <Loader scale={0.7} isFixed={false} announce label='Provisioning resources' />
            </Stack>
        </OnboardingLayout>
    );
};

export default DemoProvisioningPage;
