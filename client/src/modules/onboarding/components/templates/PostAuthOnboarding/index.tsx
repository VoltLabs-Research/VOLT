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

/** Derive the `next` destination from the URL query string. */
const useNextDestination = (): string => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    return params.get('next') ?? '/dashboard';
};

const PostAuthOnboarding = () => {
    const navigate = useNavigate();
    const next = useNextDestination();

    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
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
            <Container className='d-flex column gap-2' style={{ width: '24rem', maxWidth: '90vw' }}>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-6 font-weight-6'>Create your first team</Title>
                    <Paragraph className='color-secondary font-size-2-5'>
                        Teams let you collaborate, manage clusters, and run simulations together.
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

                    <FormFieldRHF
                        label='Description (optional)'
                        placeholder='What is this team for?'
                        value={teamDescription}
                        onChange={(e) => setTeamDescription(e.target.value)}
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
