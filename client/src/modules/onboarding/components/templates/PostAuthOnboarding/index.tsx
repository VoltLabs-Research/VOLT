import './PostAuthOnboarding.css';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { OnboardingStep, resolveOnboardingStep } from '@/modules/onboarding/utilities/resolve-onboarding-step';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { sileo } from 'sileo';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';

interface OnboardingStepState {
    title: string;
    description: string;
    progressValue: number;
};

const useNextDestination = (): string => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    return params.get('next') ?? '/dashboard';
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
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const { teams, isTeamsLoading, selectedTeamId } = useTeamData();

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const teamClusters = teamClustersQuery.data?.data ?? [];
    const hasConnectedCluster = teamClusters.some((cluster) => cluster.status === TeamClusterStatus.Connected);
    const isClustersLoading = teamClustersQuery.isLoading && Boolean(selectedTeamId);
    const isLoading = isTeamsLoading || isClustersLoading;
    const hasTeam = teams.length > 0 || Boolean(selectedTeamId);

    if (!isLoading) {
        const step = resolveOnboardingStep({ hasTeam, hasConnectedCluster });

        if (step === OnboardingStep.Done) {
            return <Navigate to={next} replace />;
        }

        if (step === OnboardingStep.Cluster) {
            return <Navigate to='/onboarding/cluster/setup' state={{ next }} replace />;
        }
    }

    const stepState: OnboardingStepState = {
        title: "Let's create a team for you!",
        description: "Invite other users to collaborate or join existing teams. You'll have the option to create new teams later.",
        progressValue: 50
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

            setSelectedTeamId(newTeam._id);
            navigate('/onboarding/cluster/setup', {
                replace: true,
                state: { next }
            });
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
            <Container className='post-auth-onboarding-shell d-flex column gap-2'>
                <Container className='d-flex column gap-075 items-center'>
                    <Container className='d-flex column items-center'>
                        <Container className='post-auth-onboarding-progress' aria-hidden='true'>
                            <span className='post-auth-onboarding-progress-fill' style={{ width: `${stepState.progressValue}%` }} />
                        </Container>
                </Container>
            </Container>

            <form className='post-auth-onboarding-content d-flex column gap-2' onSubmit={handleSubmit}>
                <Container className='d-flex column gap-1 text-center'>
                    <Title as='h1' className='font-size-6 font-weight-6'>
                        {stepState.title}
                    </Title>
                    <Paragraph className='post-auth-onboarding-description color-secondary'>
                        {stepState.description}
                    </Paragraph>
                </Container>

                <Container className='d-flex column gap-1'>
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
                </Container>

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
        </Container>
    );

    if (isLoading) {
        content = (
            <Container className='post-auth-onboarding-loading d-flex column items-center content-center gap-1'>
                <Loader scale={0.6} isFixed={false} announce label='Loading onboarding' />
            </Container>
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
