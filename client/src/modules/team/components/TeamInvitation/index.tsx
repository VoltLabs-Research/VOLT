import Button from '@/shared/presentation/primitives/Button';
import Stack from '@/shared/presentation/primitives/Stack';
import Tag from '@/shared/presentation/primitives/Tag';
import Row from '@/shared/presentation/primitives/Row';
import Heading from '@/shared/presentation/primitives/Heading';
import Text from '@/shared/presentation/primitives/Text';
import { TeamInvitationCard, TeamInvitationStateCard } from '@/modules/team/components/TeamInvitationShared';
import { useAcceptInvitationMutation, useInvitationDetailsQuery, useRejectInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import {
    getOnboardingRedirectPath,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { AlertCircle, CheckCircle, Clock, Mail, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import type { Params } from 'react-router-dom';
import './TeamInvitation.css';
interface TeamInvitationRouteParams extends Params {
    invitationId: string;
}

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
    const { invitationId } = useParams<TeamInvitationRouteParams>();
    const location = useLocation();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });

    const handleBackToDashboard = () => {
        navigate(getPostAuthRedirectPath(nextDestination));
    };

    const acceptMutation = useAcceptInvitationMutation();
    const rejectMutation = useRejectInvitationMutation();
    const actionLoading = acceptMutation.isPending || rejectMutation.isPending;

    const invitationQuery = useInvitationDetailsQuery(invitationId ?? '', {
        enabled: !!invitationId,
        retry: false
    });

    const loading = invitationQuery.isLoading;
    const invitation = invitationQuery.data ?? null;
    const queryError = invitationQuery.error;

    const displayError = error ?? (queryError
        ? (isAccessDeniedError(queryError)
            ? reportError(queryError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'You do not have permission to perform this action.'
            }).title
            : reportError(queryError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'An error occurred'
            }).title)
        : (!invitationId ? 'Invalid invitation link' : null));

    const handleAccept = async () => {
        if(!invitationId || !invitation) return;

        try {
            await runAction({
                action: () => acceptMutation.mutateAsync({ invitationId, teamId: invitation.team._id }),
                toast: ACCEPT_INVITATION_TOAST_OPTIONS,
                afterSuccess: async () => {
                    setSelectedTeamId(invitation.team._id);
                    await refreshSocketSession();
                    setError(null);
                    navigate(getOnboardingRedirectPath(nextDestination));
                }
            });
        } catch (actionError: unknown) {
            setError(reportError(actionError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to accept invitation'
            }).title);
        }
    };

    const handleReject = async () => {
        if(!invitationId || !invitation) return;

        try {
            await runAction({
                action: () => rejectMutation.mutateAsync({ invitationId, teamId: invitation.team._id }),
                toast: REJECT_INVITATION_TOAST_OPTIONS,
                afterSuccess: () => {
                    setError(null);
                    navigate(getOnboardingRedirectPath(nextDestination));
                }
            });
        } catch (actionError: unknown) {
            setError(reportError(actionError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to reject invitation'
            }).title);
        }
    };

    if(loading){
        return (
            <TeamInvitationCard>
                <Text as='p' tone='secondary'>Loading invitation...</Text>
            </TeamInvitationCard>
        );
    }

    if(displayError || !invitation || !invitation.team || !invitation.invitedBy){
        return (
            <TeamInvitationStateCard
                icon={(
                    <div className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </div>
                )}
                title='Invalid Invitation'
                description={displayError || 'This invitation is not valid or has expired'}
                action={(
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                )}
            />
        );
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired = new Date() > expiresAt;

    if(isExpired){
        return (
            <TeamInvitationStateCard
                icon={(
                    <div className='team-invitation-icon-warning'>
                        <Clock size={48} />
                    </div>
                )}
                title='Invitation Expired'
                description={`This invitation expired on ${expiresAt.toLocaleString()}`}
                action={(
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                )}
            />
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

            <Text as='p' size='md' className='color-tertiary'>
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
                    onClick={handleAccept}
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
                    onClick={handleReject}
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
