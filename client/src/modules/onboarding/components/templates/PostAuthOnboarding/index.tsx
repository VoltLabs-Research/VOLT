import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { OnboardingStep, resolveOnboardingStep } from '@/modules/onboarding/utilities/resolve-onboarding-step';
import { notifyApiError } from '@/shared/errors/notify-api-error';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { sileo } from 'sileo';
import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';

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

    const createTeam = useCreateTeamMutation();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const selectedTeamId = useSelectedTeamId();

    const teamsQuery = useTeamsQuery(undefined, { retry: false });
    const teams = teamsQuery.data ?? [];
    const isTeamsLoading = teamsQuery.isLoading;

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
        } catch (err) {
            if (!notifyApiError(err, { fallbackDescription: 'Could not create team. Please try again.' })) {
                sileo.error({
                    title: 'Team creation failed',
                    description: 'Could not create team. Please try again.'
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Container className='d-flex items-center content-center w-max vh-max'>
            <Container className='d-flex column gap-2' style={{ width: '30rem', maxWidth: '120vw' }}>
                <Container className='d-flex column gap-1 text-center'>
                    <Title className='font-size-6 font-weight-6'>Let's create a team for you!</Title>
                    <Paragraph className='color-secondary font-size-3-5'>
                        Invite other users to collaborate or join existing teams. You'll have the option to create new teams later.
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
    );
};

export default PostAuthOnboarding;
