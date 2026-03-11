import { useAcceptInvitationMutation, useInvitationDetailsQuery, useRejectInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { runHandledAction } from '@/shared/errors/handled-action';
import { getAccessDeniedMessage, getApiErrorMessage, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { AlertCircle, CheckCircle, Clock, Mail, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Params } from 'react-router-dom';
import './TeamInvitation.css';

interface TeamInvitationRouteParams extends Params {
    invitationId: string;
};

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
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const handleBackToDashboard = () => {
        navigate('/dashboard');
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
            ? getAccessDeniedMessage(queryError, 'You do not have permission to perform this action.')
            : getApiErrorMessage(queryError, 'An error occurred'))
        : (!invitationId ? 'Invalid invitation link' : null));

    const handleAccept = async () => {
        if(!invitationId || !invitation) return;

        await runHandledAction({
            action: () => acceptMutation.mutateAsync({ invitationId, teamId: invitation.team._id }),
            toast: ACCEPT_INVITATION_TOAST_OPTIONS,
            afterSuccess: () => {
                setSelectedTeamId(invitation.team._id);
                setError(null);
                navigate('/onboarding');
            },
            accessDeniedTitle: 'You do not have permission to perform this action.',
            onAccessDenied: setError,
            onError: (message) => {
                setError(getApiErrorMessage(message, 'An error occurred'));
            },
            errorToast: false,
            rethrow: false
        });
    };

    const handleReject = async () => {
        if(!invitationId || !invitation) return;

        await runHandledAction({
            action: () => rejectMutation.mutateAsync({ invitationId, teamId: invitation.team._id }),
            toast: REJECT_INVITATION_TOAST_OPTIONS,
            afterSuccess: () => {
                setError(null);
                navigate('/onboarding');
            },
            accessDeniedTitle: 'You do not have permission to perform this action.',
            onAccessDenied: setError,
            onError: (message) => {
                setError(getApiErrorMessage(message, 'An error occurred'));
            },
            errorToast: false,
            rethrow: false
        });
    };

    if(loading){
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Paragraph className='color-secondary'>Loading invitation...</Paragraph>
                </Container>
            </Container>
        );
    }

    if(displayError || !invitation || !invitation.team || !invitation.invitedBy){
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Container className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </Container>
                    <Title className='font-size-4 font-weight-6'>Invalid Invitation</Title>
                    <Paragraph className='color-secondary'>
                        {displayError || 'This invitation is not valid or has expired'}
                    </Paragraph>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                </Container>
            </Container>
        );
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired = new Date() > expiresAt;

    if(isExpired){
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Container className='team-invitation-icon-warning'>
                        <Clock size={48} />
                    </Container>
                    <Title className='font-size-4 font-weight-6'>Invitation Expired</Title>
                    <Paragraph className='color-secondary'>
                        This invitation expired on {expiresAt.toLocaleString()}
                    </Paragraph>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
            <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                <Container className='team-invitation-badge radius-full d-flex items-center gap-05'>
                    <CheckCircle size={20} />
                    <span>You've been invited!</span>
                </Container>

                <Title className='font-size-5 font-weight-6'>{invitation.team.name}</Title>

                <Paragraph className='color-secondary'>
                    You've been invited to join this team
                </Paragraph>

                <Paragraph className='font-size-2 color-tertiary'>
                    Invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                </Paragraph>

                <Container className='team-invitation-details radius-md d-flex gap-1 flex-wrap content-center'>
                    <Container className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Email</span>
                        <Paragraph className='team-invitation-detail-value d-flex items-center gap-025'>
                            <Mail size={14} />
                            {invitation.email}
                        </Paragraph>
                    </Container>
                    <Container className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Invited</span>
                        <Paragraph className='team-invitation-detail-value d-flex items-center gap-025'>
                            <Clock size={14} />
                            {new Date(invitation.createdAt).toLocaleDateString()}
                        </Paragraph>
                    </Container>
                    <Container className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Expires</span>
                        <Paragraph className='team-invitation-detail-value'>
                            {expiresAt.toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </Paragraph>
                    </Container>
                </Container>

                <Container className='team-invitation-actions d-flex gap-1 w-max'>
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
                </Container>

                {error && (
                    <Container className='team-invitation-error radius-sm d-flex items-center gap-025'>
                        <AlertCircle size={16} />
                        {error}
                    </Container>
                )}
            </Container>
        </Container>
    );
}
