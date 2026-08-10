import './PostAuthOnboarding.css';
import {
    getClusterOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { hasUsableTeamCluster } from '@/modules/cluster/utils/is-team-cluster-usable';
import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utils/demo-feature';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button, Loader } from '@voltstack/bravais';
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

    const [teamName, setTeamName] = useState(user ? `${user.firstName} ${user.lastName} team's` : "My team's");
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
    const clusterDestination = isDemoClusterFeatureEnabled()
        ? '/onboarding/cluster/choice'
        : getClusterOnboardingRedirectPath(next);

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
                <div className='flex flex-col items-center justify-center gap-4 post-auth-onboarding-loading'>
                    <Loader scale={0.6} isFixed={false} announce label='Loading onboarding' />
                </div>
            ) : (
                <div className='flex flex-col gap-8 post-auth-onboarding-shell'>
                    <form className='post-auth-onboarding-content flex flex-col gap-8' onSubmit={handleSubmit}>
                        <div className='flex flex-col gap-4 text-center'>
                            <h1 className='text-3xl font-semibold text-foreground'>
                                Let&apos;s create a team for you!
                            </h1>
                            <p className='text-muted post-auth-onboarding-description'>
                                Invite other users to collaborate or join existing teams. You&apos;ll have the option to create new teams later.
                            </p>
                        </div>

                        <div className='flex flex-col gap-4'>
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
                        </div>

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
                </div>
            )}
        </OnboardingLayout>
    );
};

export default PostAuthOnboarding;
