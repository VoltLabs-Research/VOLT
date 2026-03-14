import './PostAuthOnboarding.css';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { OnboardingStep, resolveOnboardingStep } from '@/modules/onboarding/utilities/resolve-onboarding-step';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import { openModal } from '@/shared/presentation/components/Modal';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import { sileo } from 'sileo';
import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useTeamData from '@/modules/team/hooks/team/use-team-data';

interface OnboardingStepState {
    title: string;
    description: string;
    progressLabel: string;
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

    const [teamName, setTeamName] = useState(`${user?.firstName} ${user?.lastName} team's`);
    // TODO: Delete description field in the onboarding, UI/UX noise
    const [teamDescription, _setTeamDescription] = useState('');
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
    const hasConnectedCluster = teamClusters.some((c) => c.status === TeamClusterStatus.Connected);
    const isClustersLoading = teamClustersQuery.isLoading && Boolean(selectedTeamId);

    const hasTeam = teams.length > 0 || Boolean(selectedTeamId);

    if (isTeamsLoading || isClustersLoading) {
        return <Loader scale={0.6} />;
    }

    const step = resolveOnboardingStep({ hasTeam, hasConnectedCluster });

    if (step === OnboardingStep.Done) {
        return <Navigate to={next} replace />;
    }

    if (step === OnboardingStep.Cluster) {
        return <Navigate to='/onboarding/cluster/setup' state={{ next }} replace />;
    }

    const stepState: OnboardingStepState = {
        title: "Let's create a team for you!",
        description: "Invite other users to collaborate or join existing teams. You'll have the option to create new teams later.",
        progressLabel: 'Step 1 of 2 · Team setup',
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
                description: teamDescription.trim()
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

    const handleOpenJoinModal = () => openModal('join-team-modal');

    return (
        <Container className='post-auth-onboarding-page d-flex column items-center content-center w-max vh-max'>
            <Container className='post-auth-onboarding-shell d-flex column gap-2'>
                <Container className='post-auth-onboarding-topbar d-flex items-center content-between gap-1 flex-wrap'>
                    <Container className='d-flex column gap-025'>
                        <span className='font-size-1 font-weight-6 color-secondary'>{stepState.progressLabel}</span>
                        <Container className='post-auth-onboarding-progress' aria-hidden='true'>
                            <span className='post-auth-onboarding-progress-fill' style={{ width: `${stepState.progressValue}%` }} />
                        </Container>
                    </Container>
                    <Button className='post-auth-onboarding-invite-btn' variant='ghost' intent='neutral' size='sm' onClick={handleOpenJoinModal}>
                        Have an invite code?
                    </Button>
                </Container>

                <Container className='d-flex column gap-2' style={{ width: '30rem', maxWidth: '100%' }}>
                    <Container className='d-flex column gap-1 text-center'>
                        <Title className='font-size-6 font-weight-6'>{stepState.title}</Title>
                        <Paragraph className='color-secondary font-size-3-5'>
                            {stepState.description}
                        </Paragraph>
                    </Container>

                    <Container className='d-flex column gap-1'>
                        <FormFieldRHF
                            label='Team name'
                            placeholder='e.g., Research Lab'
                            value={teamName}
                            error={nameError}
                            onChange={(e) => {
                                setTeamName(e.target.value);
                                if (nameError) setNameError(undefined);
                            }}
                            inputProps={{
                                onKeyDown: (e) => { if (e.key === 'Enter') handleCreateTeam(); }
                            }}
                        />
                    </Container>

                    <Button
                        variant='solid'
                        intent='brand'
                        size='lg'
                        shape='pill'
                        block
                        onClick={handleCreateTeam}
                        isLoading={isSubmitting}
                    >
                        Create Team & Continue
                    </Button>
                </Container>
            </Container>

            <JoinTeamModal />

            <Container className='post-auth-onboarding-floating-tools d-flex items-center gap-075'>
                {user && (
                    <Container className='post-auth-onboarding-user-info'>
                        <UserMenuPopover
                            onSettingsClick={handleSettingsClick}
                            onSignOut={handleSignOut}
                            isSigningOut={isSigningOut}
                        />
                    </Container>
                )}
                <Container className='post-auth-onboarding-notifications'>
                    <NotificationsPopover />
                </Container>
            </Container>
        </Container>
    );
};

export default PostAuthOnboarding;
