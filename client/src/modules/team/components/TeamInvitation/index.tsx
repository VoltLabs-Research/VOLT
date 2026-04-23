import { Button } from '@/shared/presentation/primitives';
import { useAcceptInvitationMutation, useInvitationDetailsQuery, useRejectInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import {
    getOnboardingRedirectPath,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { AlertCircle, CheckCircle, Clock, Mail, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
                afterSuccess: () => {
                    setSelectedTeamId(invitation.team._id);
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
            <div className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <p className='color-secondary'>Loading invitation...</p>
                </div>
            </div>
        );
    }

    if(displayError || !invitation || !invitation.team || !invitation.invitedBy){
        return (
            <div className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </div>
                    <h3 className='font-size-4 font-weight-6'>Invalid Invitation</h3>
                    <p className='color-secondary'>
                        {displayError || 'This invitation is not valid or has expired'}
                    </p>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired = new Date() > expiresAt;

    if(isExpired){
        return (
            <div className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='team-invitation-icon-warning'>
                        <Clock size={48} />
                    </div>
                    <h3 className='font-size-4 font-weight-6'>Invitation Expired</h3>
                    <p className='color-secondary'>
                        This invitation expired on {expiresAt.toLocaleString()}
                    </p>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleBackToDashboard}
                    >
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className='team-invitation-page w-max vh-max d-flex items-center content-center'>
            <div className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                <div className='team-invitation-badge radius-full d-flex items-center gap-05'>
                    <CheckCircle size={20} />
                    <span>You've been invited!</span>
                </div>

                <h3 className='font-size-5 font-weight-6'>{invitation.team.name}</h3>

                <p className='color-secondary'>
                    You've been invited to join this team
                </p>

                <p className='font-size-2 color-tertiary'>
                    Invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                </p>

                <div className='team-invitation-details radius-md d-flex gap-1 flex-wrap content-center'>
                    <div className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Email</span>
                        <p className='team-invitation-detail-value d-flex items-center gap-025'>
                            <Mail size={14} />
                            {invitation.email}
                        </p>
                    </div>
                    <div className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Invited</span>
                        <p className='team-invitation-detail-value d-flex items-center gap-025'>
                            <Clock size={14} />
                            {new Date(invitation.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <div className='team-invitation-detail text-center'>
                        <span className='team-invitation-detail-label'>Expires</span>
                        <p className='team-invitation-detail-value'>
                            {expiresAt.toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                </div>

                <div className='team-invitation-actions d-flex gap-1 w-max'>
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
                </div>

                {error && (
                    <div className='team-invitation-error radius-sm d-flex items-center gap-025'>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
