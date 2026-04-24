import './PostAuthOnboarding.css';
import {
    getClusterOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { hasUsableTeamCluster } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utilities/demo-feature';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { OnboardingStep, resolveOnboardingStep } from '@/modules/onboarding/utilities/resolve-onboarding-step';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Loader from '@/shared/presentation/primitives/Loader';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { sileo } from 'sileo';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';
interface OnboardingStepState {
    title: string;
    description: string;
};

const useNextDestination = (): string => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    return resolvePostAuthDestination({
        queryNext: params.get('next')
    });
};

const PostAuthOnboarding = () => {
    const navigate = useNavigate();
    const next = useNextDestination();
    const user = useCurrentUser();
    const defaultTeamName = user ? `${user.firstName} ${user.lastName} team's` : "My team's";

    const [teamName, setTeamName] = useState(defaultTeamName);
    const [nameError, setNameError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const createTeam = useCreateTeamMutation();
    const { teams, isTeamsLoading, selectedTeamId } = useTeamData();

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const hasConnectedCluster = teamClustersQuery.isSuccess
        ? hasUsableTeamCluster(teamClustersQuery.data.data)
        : false;
    const isClustersLoading = teamClustersQuery.isLoading && Boolean(selectedTeamId);
    const isLoading = isTeamsLoading || isClustersLoading;
    const hasTeam = teams.length > 0 || Boolean(selectedTeamId);

    if (teamClustersQuery.isError && selectedTeamId) {
        throw teamClustersQuery.error;
    }

    if (!isLoading && (!selectedTeamId || teamClustersQuery.isSuccess)) {
        const step = resolveOnboardingStep({ hasTeam, hasConnectedCluster });

        if (step === OnboardingStep.Done) {
            return <Navigate to={next} replace />;
        }

        if (step === OnboardingStep.Cluster) {
            if (isDemoClusterFeatureEnabled()) {
                return <Navigate to='/onboarding/cluster/provisioning' replace />;
            }
            return <Navigate to={getClusterOnboardingRedirectPath(next)} replace />;
        }
    }

    const stepState: OnboardingStepState = {
        title: "Let's create a team for you!",
        description: "Invite other users to collaborate or join existing teams. You'll have the option to create new teams later."
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim()) {
            setNameError('Team name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const newTeam = await createTeam.mutateAsync({
                name: teamName.trim(),
                description: ''
            });

            sileo.success({
                title: 'Team created',
                description: `"${newTeam.name}" is ready.`
            });

            switchSelectedTeam(newTeam._id);
            navigate(getClusterOnboardingRedirectPath(next), { replace: true });
        } catch (err: unknown) {
            reportError(err, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Team creation failed',
                fallbackDescription: 'Could not create team. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await handleCreateTeam();
    };

    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch {
            sileo.error({ title: 'Sign out failed', description: 'Please try again.' });
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleSettingsClick = () => {
        navigate('/dashboard/settings/general');
    };

    let content: ReactNode = (
        <Stack gap='2' className='post-auth-onboarding-shell'>
            <form className='post-auth-onboarding-content d-flex column gap-2' onSubmit={handleSubmit}>
                <Stack gap='1' textAlign='center'>
                    <Heading level={1} size='3xl' weight='bold'>
                        {stepState.title}
                    </Heading>
                    <Text as='p' tone='secondary' className='post-auth-onboarding-description'>
                        {stepState.description}
                    </Text>
                </Stack>

                <Stack gap='1'>
                    <FormFieldRHF
                        label='Team name'
                        placeholder='e.g., Research Lab'
                        value={teamName}
                        error={nameError}
                        onChange={(event) => {
                            setTeamName(event.target.value);
                            if (nameError) {
                                setNameError(undefined);
                            }
                        }}
                    />
                </Stack>

                <Button
                    variant='solid'
                    intent='brand'
                    size='lg'
                    shape='pill'
                    block
                    type='submit'
                    isLoading={isSubmitting}
                >
                    Create Team & Continue
                </Button>
            </form>
        </Stack>
    );

    if (isLoading) {
        content = (
            <Stack align='center' justify='center' gap='1' className='post-auth-onboarding-loading'>
                <Loader scale={0.6} isFixed={false} announce label='Loading onboarding' />
            </Stack>
        );
    }

    return (
        <OnboardingLayout
            onSettingsClick={handleSettingsClick}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
        >
            {content}
        </OnboardingLayout>
    );
};

export default PostAuthOnboarding;
