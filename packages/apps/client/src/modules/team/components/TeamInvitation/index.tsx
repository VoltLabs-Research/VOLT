import Loader from '@/shared/ui/components/Loader';
import { Button } from '@heroui/react';
import {
    TeamInvitationActions,
    TeamInvitationCard,
    TeamInvitationDetailItem,
    TeamInvitationDetails,
    TeamInvitationHeading,
    TeamInvitationLoader,
    TeamInvitationStateCard
} from '@/modules/team/components/TeamInvitationShared';
import { useAcceptInvitationMutation, useInvitationDetailsQuery, useRejectInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import {
    getOnboardingRedirectPath,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
import { ErrorSurface } from '@/shared/contracts/errors';
import { isAccessDeniedError, reportError } from '@/shared/errors/core/report-error';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

const ACCEPT_INVITATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Accepting invitation...',
    success: 'Invitation accepted!',
    error: 'Failed to accept invitation'
});

const REJECT_INVITATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Rejecting invitation...',
    success: 'Invitation rejected',
    error: 'Failed to reject invitation'
});

export default function TeamInvitationTemplate() {
    const { invitationId } = useParams<{ invitationId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });

    const acceptMutation = useAcceptInvitationMutation();
    const rejectMutation = useRejectInvitationMutation();
    const actionLoading = acceptMutation.isPending || rejectMutation.isPending;

    const invitationQuery = useInvitationDetailsQuery(invitationId ?? '', {
        enabled: !!invitationId,
        retry: false
    });

    const invitation = invitationQuery.data ?? null;
    const queryError = invitationQuery.error;

    const displayError = error
        ?? (queryError
            ? reportError(queryError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: isAccessDeniedError(queryError)
                    ? 'You do not have permission to perform this action.'
                    : 'An error occurred'
            }).title
            : (!invitationId ? 'Invalid invitation link' : null));

    const respondToInvitation = async (
        action: 'accept' | 'reject'
    ) => {
        if(!invitationId || !invitation) return;

        const isAccept = action === 'accept';
        const mutation = isAccept ? acceptMutation : rejectMutation;

        try {
            await runAction({
                action: () => mutation.mutateAsync({
                    invitationId,
                    teamId: invitation.team._id
                }),
                toast: isAccept ? ACCEPT_INVITATION_TOAST_OPTIONS : REJECT_INVITATION_TOAST_OPTIONS,
                afterSuccess: async () => {
                    if (isAccept) {
                        setSelectedTeamId(invitation.team._id);
                        await refreshSocketSession();
                    }
                    setError(null);
                    navigate(getOnboardingRedirectPath(nextDestination));
                }
            });
        } catch (actionError: unknown) {
            setError(reportError(actionError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: isAccept ? 'Failed to accept invitation' : 'Failed to reject invitation'
            }).title);
        }
    };

    const renderUnavailableCard = (title: string, description: string) => (
        <TeamInvitationStateCard
            title={title}
            description={description}
            action={(
                <Button
                    variant='primary'
                    size='sm'
                    onPress={() => navigate(getPostAuthRedirectPath(nextDestination))}
                >
                    Back to Dashboard
                </Button>
            )}
        />
    );

    if(invitationQuery.isLoading){
        return <TeamInvitationLoader />;
    }

    if(displayError || !invitation){
        return renderUnavailableCard(
            'Invalid Invitation',
            displayError || 'This invitation is not valid or has expired'
        );
    }

    const expiresAt = new Date(invitation.expiresAt);

    if(new Date() > expiresAt){
        return renderUnavailableCard(
            'Invitation Expired',
            `This invitation expired on ${expiresAt.toLocaleString()}`
        );
    }

    return (
        <TeamInvitationCard>
            <TeamInvitationHeading
                eyebrow='You&apos;ve been invited!'
                title={invitation.team.name}
                description={`${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} invited you to join this team.`}
            />

            <TeamInvitationDetails>
                <TeamInvitationDetailItem label='Email' value={invitation.email} />
                <TeamInvitationDetailItem label='Invited' value={new Date(invitation.createdAt).toLocaleDateString()} />
                <TeamInvitationDetailItem
                    label='Expires'
                    value={expiresAt.toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                />
            </TeamInvitationDetails>

            <TeamInvitationActions>
                <Button
                    variant='primary'
                    fullWidth
                    onPress={() => respondToInvitation('accept')}
                    isDisabled={actionLoading}
                    isPending={acceptMutation.isPending}
                >
                    {acceptMutation.isPending && <Loader size='sm' color='current' />}
                    Accept Invitation
                </Button>
                <Button
                    variant='secondary'
                    fullWidth
                    onPress={() => respondToInvitation('reject')}
                    isDisabled={actionLoading}
                    isPending={rejectMutation.isPending}
                >
                    {rejectMutation.isPending && <Loader size='sm' color='current' />}
                    Reject Invitation
                </Button>
            </TeamInvitationActions>

            {error && (
                <p className='text-sm text-danger-soft-foreground' role='alert'>
                    {error}
                </p>
            )}
        </TeamInvitationCard>
    );
}
