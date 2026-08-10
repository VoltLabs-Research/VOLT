import { Button, Chip, Spinner, cn } from '@heroui/react';
import {
    TEAM_INVITATION_ACTIONS_CLASS,
    TEAM_INVITATION_DETAILS_CLASS,
    TEAM_INVITATION_DETAIL_CLASS,
    TEAM_INVITATION_DETAIL_LABEL_CLASS,
    TEAM_INVITATION_DETAIL_VALUE_CLASS,
    TEAM_INVITATION_ICON_ERROR_CLASS,
    TEAM_INVITATION_ICON_WARNING_CLASS,
    TeamInvitationCard,
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
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { AlertCircle, CheckCircle, Clock, Mail, XCircle } from 'lucide-react';
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

    const renderUnavailableCard = (icon: 'error' | 'warning', title: string, description: string) => (
        <TeamInvitationStateCard
            icon={(
                <div className={icon === 'error' ? TEAM_INVITATION_ICON_ERROR_CLASS : TEAM_INVITATION_ICON_WARNING_CLASS}>
                    {icon === 'error' ? <XCircle size={48} /> : <Clock size={48} />}
                </div>
            )}
            title={title}
            description={description}
            action={(
                <Button
                    variant='primary'
                    onPress={() => navigate(getPostAuthRedirectPath(nextDestination))}
                >
                    Back to Dashboard
                </Button>
            )}
        />
    );

    if(invitationQuery.isLoading){
        return (
            <TeamInvitationCard>
                <p className='text-muted'>Loading invitation...</p>
            </TeamInvitationCard>
        );
    }

    if(displayError || !invitation){
        return renderUnavailableCard(
            'error',
            'Invalid Invitation',
            displayError || 'This invitation is not valid or has expired'
        );
    }

    const expiresAt = new Date(invitation.expiresAt);

    if(new Date() > expiresAt){
        return renderUnavailableCard(
            'warning',
            'Invitation Expired',
            `This invitation expired on ${expiresAt.toLocaleString()}`
        );
    }

    return (
        <TeamInvitationCard>
            <Chip color='success' variant='soft' size='md'>
                <CheckCircle size={20} aria-hidden='true' />
                <Chip.Label>You&apos;ve been invited!</Chip.Label>
            </Chip>

            <h3 className='text-2xl font-semibold text-foreground'>{invitation.team.name}</h3>

            <p className='text-muted'>
                You've been invited to join this team
            </p>

            <p className='text-sm text-muted'>
                Invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
            </p>

            <div className={cn('flex flex-row items-center justify-center flex-wrap gap-4 rounded-xl', TEAM_INVITATION_DETAILS_CLASS)}>
                <div className={cn('flex flex-col text-center', TEAM_INVITATION_DETAIL_CLASS)}>
                    <span className={TEAM_INVITATION_DETAIL_LABEL_CLASS}>Email</span>
                    <p className={cn('flex flex-row items-center gap-1', TEAM_INVITATION_DETAIL_VALUE_CLASS)}>
                        <Mail size={14} />
                        {invitation.email}
                    </p>
                </div>
                <div className={cn('flex flex-col text-center', TEAM_INVITATION_DETAIL_CLASS)}>
                    <span className={TEAM_INVITATION_DETAIL_LABEL_CLASS}>Invited</span>
                    <p className={cn('flex flex-row items-center gap-1', TEAM_INVITATION_DETAIL_VALUE_CLASS)}>
                        <Clock size={14} />
                        {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <div className={cn('flex flex-col text-center', TEAM_INVITATION_DETAIL_CLASS)}>
                    <span className={TEAM_INVITATION_DETAIL_LABEL_CLASS}>Expires</span>
                    <p className={TEAM_INVITATION_DETAIL_VALUE_CLASS}>
                        {expiresAt.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </p>
                </div>
            </div>

            <div className={cn('flex flex-row items-center gap-4 w-full', TEAM_INVITATION_ACTIONS_CLASS)}>
                <Button
                    variant='primary'
                    fullWidth
                    onPress={() => respondToInvitation('accept')}
                    isDisabled={actionLoading}
                    isPending={actionLoading}
                >
                    {actionLoading
                        ? <Spinner size='sm' color='current' />
                        : <CheckCircle size={20} aria-hidden='true' />}
                    Accept Invitation
                </Button>
                <Button
                    variant='outline'
                    fullWidth
                    onPress={() => respondToInvitation('reject')}
                    isDisabled={actionLoading}
                >
                    <XCircle size={20} aria-hidden='true' />
                    Reject Invitation
                </Button>
            </div>

            {error && (
                <Chip color='danger' variant='soft' size='md'>
                    <AlertCircle size={16} aria-hidden='true' />
                    <Chip.Label>{error}</Chip.Label>
                </Chip>
            )}
        </TeamInvitationCard>
    );
}
