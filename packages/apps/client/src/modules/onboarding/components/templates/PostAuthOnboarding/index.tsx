import Loader from '@/shared/ui/components/Loader';
import {
    getClusterOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { hasUsableTeamCluster } from '@/modules/cluster/utils/is-team-cluster-usable';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { sileo } from 'sileo';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';

const PostAuthOnboarding = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const next = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });
    const user = useCurrentUser();

    const [teamName, setTeamName] = useState(user ? `${user.firstName} ${user.lastName}'s team` : 'My team');
    const [nameError, setNameError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

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
    const clusterDestination = getClusterOnboardingRedirectPath(next);

    if (teamClustersQuery.isError && selectedTeamId) {
        throw teamClustersQuery.error;
    }

    if (!isLoading && (!selectedTeamId || teamClustersQuery.isSuccess) && hasTeam) {
        return <Navigate to={hasConnectedCluster ? next : clusterDestination} replace />;
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

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
            navigate(clusterDestination, { replace: true });
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

    return (
        <OnboardingLayout
            onSettingsClick={handleSettingsClick}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
        >
            {isLoading ? (
                <div
                    className='flex w-full max-w-sm flex-col items-center justify-center gap-4'
                    role='status'
                    aria-live='polite'
                    aria-atomic='true'
                >
                    <Loader size='md' color='current' className='text-muted' />
                    <span className='text-center text-sm text-muted'>
                        Loading onboarding
                    </span>
                </div>
            ) : (
                <div className='flex w-full max-w-sm flex-col gap-8'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='heading-reveal text-3xl font-semibold tracking-[-0.03em] text-foreground'>
                            Let&apos;s create a team for you!
                        </h1>
                        <p className='text-base text-muted'>
                            Invite other users to collaborate or join existing teams. You&apos;ll have the option to create new teams later.
                        </p>
                    </header>

                    <form className='flex flex-col gap-4' onSubmit={handleSubmit}>
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

                        <Button
                            variant='primary'
                            size='lg'
                            fullWidth
                            type='submit'
                            isPending={isSubmitting}
                        >
                            Create Team & Continue
                        </Button>
                    </form>
                </div>
            )}
        </OnboardingLayout>
    );
};

export default PostAuthOnboarding;
