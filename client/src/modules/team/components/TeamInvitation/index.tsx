import { Button, Stack, Tag, Row, Heading, Text } from '@voltstack/bravais';
import { TeamInvitationCard, TeamInvitationStateCard } from '@/modules/team/components/TeamInvitationShared';
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
import './TeamInvitation.css';

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
                <div className={icon === 'error' ? 'team-invitation-icon-error' : 'team-invitation-icon-warning'}>
                    {icon === 'error' ? <XCircle size={48} /> : <Clock size={48} />}
                </div>
            )}
            title={title}
            description={description}
            action={(
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={() => navigate(getPostAuthRedirectPath(nextDestination))}
                >
                    Back to Dashboard
                </Button>
            )}
        />
    );

    if(invitationQuery.isLoading){
        return (
            <TeamInvitationCard>
                <Text as='p' tone='secondary'>Loading invitation...</Text>
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
            <Tag tone='success' variant='soft' size='md' leftIcon={<CheckCircle size={20} />}>
                You've been invited!
            </Tag>

            <Heading level={3} size='2xl' weight='bold'>{invitation.team.name}</Heading>

            <Text as='p' tone='secondary'>
                You've been invited to join this team
            </Text>

            <Text as='p' size='md' className='text-tertiary'>
                Invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
            </Text>

            <Row gap='1' wrap justify='center' radius='md' className='team-invitation-details'>
                <Stack className='team-invitation-detail' textAlign='center'>
                    <Text as='span' className='team-invitation-detail-label'>Email</Text>
                    <Row as='p' gap='025' className='team-invitation-detail-value'>
                        <Mail size={14} />
                        {invitation.email}
                    </Row>
                </Stack>
                <Stack className='team-invitation-detail' textAlign='center'>
                    <Text as='span' className='team-invitation-detail-label'>Invited</Text>
                    <Row as='p' gap='025' className='team-invitation-detail-value'>
                        <Clock size={14} />
                        {new Date(invitation.createdAt).toLocaleDateString()}
                    </Row>
                </Stack>
                <Stack className='team-invitation-detail' textAlign='center'>
                    <Text as='span' className='team-invitation-detail-label'>Expires</Text>
                    <Text as='p' className='team-invitation-detail-value'>
                        {expiresAt.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                </Stack>
            </Row>

            <Row gap='1' width='max' className='team-invitation-actions'>
                <Button
                    variant='solid'
                    intent='brand'
                    block
                    leftIcon={<CheckCircle size={20} />}
                    onClick={() => respondToInvitation('accept')}
                    disabled={actionLoading}
                    isLoading={actionLoading}
                >
                    Accept Invitation
                </Button>
                <Button
                    variant='outline'
                    intent='neutral'
                    block
                    leftIcon={<XCircle size={20} />}
                    onClick={() => respondToInvitation('reject')}
                    disabled={actionLoading}
                >
                    Reject Invitation
                </Button>
            </Row>

            {error && (
                <Tag tone='danger' variant='soft' size='md' leftIcon={<AlertCircle size={16} />}>
                    {error}
                </Tag>
            )}
        </TeamInvitationCard>
    );
}
