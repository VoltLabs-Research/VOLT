import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { Button, Stack } from '@voltstack/bravais';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { hasUsableTeamCluster } from '@/modules/cluster/utils/is-team-cluster-usable';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utils/demo-feature';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';
import {
    useProvisionDemoTeamClusterMutation,
    useTeamClustersQuery
} from '@/modules/cluster/hooks/team-cluster/queries';
import ProcessingLoader from '@/shared/ui/components/ProcessingLoader';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { sileo } from 'sileo';
import { reportError, ErrorSurface } from '@/shared/errors/core';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

const formatRemaining = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const DemoProvisioningPage = () => {
    const navigate = useNavigate();
    const user = useCurrentUser();
    const selectedTeamId = useSelectedTeamId();
    const setFromCluster = useDemoClusterStore((state) => state.setFromCluster);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

    const [hasTriggered, setHasTriggered] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const [remainingMs, setRemainingMs] = useState(POLL_TIMEOUT_MS);
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
        setRemainingMs(POLL_TIMEOUT_MS);
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
        if (!isWaiting) {
            return;
        }

        const tick = () => {
            const started = startedAtRef.current ?? Date.now();
            const remaining = POLL_TIMEOUT_MS - (Date.now() - started);

            if (remaining <= 0) {
                setRemainingMs(0);
                setIsWaiting(false);
                setHasFailed(true);
                setHasTimedOut(true);
                sileo.error({
                    title: 'Provisioning timed out',
                    description: 'Please try again or connect your own cluster.'
                });
                return;
            }

            setRemainingMs(remaining);
        };

        tick();
        const intervalId = window.setInterval(tick, 1000);

        return () => window.clearInterval(intervalId);
    }, [isWaiting]);

    useEffect(() => {
        if (!isWaiting) {
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

    const handleRetry = () => {
        setHasFailed(false);
        setHasTimedOut(false);
        setRemainingMs(POLL_TIMEOUT_MS);
        setHasTriggered(false);
    };

    if (!isDemoClusterFeatureEnabled()) {
        return <Navigate to='/onboarding/cluster/setup' replace />;
    }

    if (hasFailed) {
        const failureTitle = hasTimedOut ? 'Demo provisioning timed out' : 'Demo provisioning failed';
        const failureDescription = hasTimedOut
            ? 'We couldn’t spin up a demo cluster in time. This can happen under load — retry, or connect your own cluster instead.'
            : 'We couldn’t spin up a demo cluster. You can retry, or connect your own cluster instead.';

        return (
            <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick} isSigningOut={isSigningOut}>
                <Stack gap='1' align='center' justify='center' className='min-h-screen'>
                    <RecoveryState
                        tone={RecoveryStateTone.Error}
                        title={failureTitle}
                        description={failureDescription}
                        retryLabel='Try again'
                        onRetry={handleRetry}
                    />
                    <Button variant='ghost' intent='neutral' onClick={() => navigate('/onboarding/cluster/setup')}>
                        Connect your own cluster instead
                    </Button>
                </Stack>
            </OnboardingLayout>
        );
    }

    const elapsedRate = (POLL_TIMEOUT_MS - remainingMs) / POLL_TIMEOUT_MS;

    return (
        <OnboardingLayout onSignOut={handleSignOut} onSettingsClick={handleSettingsClick} isSigningOut={isSigningOut}>
            <Stack align='center' justify='center' gap='1-5' className='min-h-screen'>
                <ProcessingLoader
                    isVisible
                    showProgress
                    completionRate={elapsedRate}
                    message={`Provisioning your demo cluster… ${formatRemaining(remainingMs)} remaining`}
                />
            </Stack>
        </OnboardingLayout>
    );
};

export default DemoProvisioningPage;
