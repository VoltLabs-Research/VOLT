import './TeamInvitationByCode.css';
import '../TeamInvitation/TeamInvitation.css';
import {
    clearPostAuthDestination,
    getOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { useJoinByCodeMutation, usePreviewJoinByCodeQuery } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Button from '@/shared/presentation/components/Button';
import { AlertCircle, CheckCircle, LoaderCircle, ShieldCheck, Users, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Params } from 'react-router-dom';

interface TeamInvitationByCodeRouteParams extends Params {
    code: string;
};

enum TeamInvitationByCodeStatus {
    Ready = 'ready',
    Joining = 'joining',
    AlreadyMember = 'already-member',
    Error = 'error'
};

const isAlreadyMemberError = (message: string): boolean => {
    return message.toLowerCase().includes('already a member');
};

const TeamInvitationByCodeTemplate = () => {
    const { code } = useParams<TeamInvitationByCodeRouteParams>();
    const navigate = useNavigate();
    const location = useLocation();
    const joinByCodeMutation = useJoinByCodeMutation();
    const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);
    const normalizedCode = useMemo(() => code?.trim().toUpperCase() ?? '', [code]);
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });
    const previewQuery = usePreviewJoinByCodeQuery(
        { code: normalizedCode },
        {
            enabled: normalizedCode.length === 5,
            retry: false
        }
    );
    const preview = previewQuery.data;

    const handleNavigateToNextDestination = useCallback(() => {
        clearPostAuthDestination();
        navigate(getOnboardingRedirectPath(nextDestination));
    }, [navigate, nextDestination]);

    const handleJoinTeam = useCallback(async () => {
        if (!normalizedCode) {
            return;
        }

        setJoinErrorMessage(null);

        try {
            const result = await joinByCodeMutation.mutateAsync({ code: normalizedCode });

            switchSelectedTeam(result.teamId);
            await refreshSocketSession();
            clearPostAuthDestination();

            navigate(getOnboardingRedirectPath(nextDestination), { replace: true });
        } catch (error: unknown) {
            const friendlyMessage = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'This invite link is invalid or has expired.'
            }).title;

            if (isAlreadyMemberError(friendlyMessage)) {
                setJoinErrorMessage('You are already a member of this team. You can continue to your dashboard.');
                return;
            }

            setJoinErrorMessage(friendlyMessage || 'This invite link is invalid or has expired.');
        }
    }, [joinByCodeMutation, navigate, nextDestination, normalizedCode]);

    const previewErrorMessage = useMemo(() => {
        if (!normalizedCode) {
            return 'Invalid invitation link.';
        }

        if (!previewQuery.error) {
            return null;
        }

        return reportError(previewQuery.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'This invite link is invalid or has expired.'
        }).title;
    }, [normalizedCode, previewQuery.error]);

    let status = TeamInvitationByCodeStatus.Ready;
    if (preview?.isAlreadyMember || isAlreadyMemberError(joinErrorMessage ?? '')) {
        status = TeamInvitationByCodeStatus.AlreadyMember;
    } else if (!normalizedCode || previewErrorMessage || joinErrorMessage) {
        status = TeamInvitationByCodeStatus.Error;
    } else if (joinByCodeMutation.isPending) {
        status = TeamInvitationByCodeStatus.Joining;
    }

    if (previewQuery.isLoading) {
        return (
            <div className='volt-container team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='volt-container team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='volt-container team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <LoaderCircle size={48} className='team-invitation-by-code-spinner' />
                    </div>
                    <h3 className='volt-title font-size-4 font-weight-6'>Reviewing invite...</h3>
                    <p className='volt-text color-secondary'>
                        We are checking the invite details before you join the team.
                    </p>
                </div>
            </div>
        );
    }

    if (status === TeamInvitationByCodeStatus.Joining) {
        return (
            <div className='volt-container team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='volt-container team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='volt-container team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <LoaderCircle size={48} className='team-invitation-by-code-spinner' />
                    </div>
                    <h3 className='volt-title font-size-4 font-weight-6'>Joining team...</h3>
                    <p className='volt-text color-secondary'>
                        We are confirming your membership and preparing your workspace.
                    </p>
                </div>
            </div>
        );
    }

    if (status === TeamInvitationByCodeStatus.AlreadyMember) {
        return (
            <div className='volt-container team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='volt-container team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='volt-container team-invitation-badge radius-full d-flex items-center gap-05'>
                        <Users size={20} />
                        <span>Already joined</span>
                    </div>
                    <h3 className='volt-title font-size-4 font-weight-6'>You are already in this team</h3>
                    {preview && (
                        <div className='volt-container team-invitation-details radius-md d-flex items-start gap-1 wrap'>
                            <div className='volt-container team-invitation-detail d-flex column'>
                                <span className='team-invitation-detail-label'>Team</span>
                                <span className='team-invitation-detail-value'>{preview.teamName}</span>
                            </div>
                            <div className='volt-container team-invitation-detail d-flex column'>
                                <span className='team-invitation-detail-label'>Owner</span>
                                <span className='team-invitation-detail-value'>{preview.ownerName}</span>
                            </div>
                        </div>
                    )}
                    <p className='volt-text color-secondary'>
                        {joinErrorMessage || 'You already have access to this team. Continue to your dashboard when you are ready.'}
                    </p>
                    <Button
                        variant='solid'
                        intent='brand'
                        leftIcon={<CheckCircle size={18} />}
                        onClick={handleNavigateToNextDestination}
                    >
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    if (status === TeamInvitationByCodeStatus.Error) {
        return (
            <div className='volt-container team-invitation-page w-max vh-max d-flex items-center content-center'>
                <div className='volt-container team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <div className='volt-container team-invitation-icon-error'>
                        <XCircle size={48} />
                    </div>
                    <h3 className='volt-title font-size-4 font-weight-6'>Could not join this team</h3>
                    <p className='volt-text color-secondary'>
                        {joinErrorMessage || previewErrorMessage || 'This invite link is invalid or has expired.'}
                    </p>
                    <div className='volt-container team-invitation-error radius-sm d-flex items-center gap-025'>
                        <AlertCircle size={16} />
                        Please ask for a new invite link or try again later.
                    </div>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleNavigateToNextDestination}
                    >
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className='volt-container team-invitation-page w-max vh-max d-flex items-center content-center'>
            <div className='volt-container team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                <div className='volt-container team-invitation-by-code-icon team-invitation-by-code-icon-ready'>
                    <ShieldCheck size={40} />
                </div>
                <h3 className='volt-title font-size-4 font-weight-6'>Join this team?</h3>
                <p className='volt-text color-secondary'>
                    Review the invite details below, then confirm to join this workspace.
                </p>
                {preview && (
                    <div className='volt-container team-invitation-details radius-md d-flex items-start gap-1 wrap'>
                        <div className='volt-container team-invitation-detail d-flex column'>
                            <span className='team-invitation-detail-label'>Team</span>
                            <span className='team-invitation-detail-value'>{preview.teamName}</span>
                        </div>
                        <div className='volt-container team-invitation-detail d-flex column'>
                            <span className='team-invitation-detail-label'>Owner</span>
                            <span className='team-invitation-detail-value'>{preview.ownerName}</span>
                        </div>
                        <div className='volt-container team-invitation-detail d-flex column'>
                            <span className='team-invitation-detail-label'>Invite code</span>
                            <span className='team-invitation-detail-value'>{normalizedCode}</span>
                        </div>
                    </div>
                )}
                <div className='volt-container team-invitation-actions d-flex items-center gap-075'>
                    <Button variant='ghost' intent='neutral' onClick={handleNavigateToNextDestination}>
                        Cancel
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        leftIcon={<CheckCircle size={18} />}
                        onClick={handleJoinTeam}
                    >
                        Join Team
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TeamInvitationByCodeTemplate;
