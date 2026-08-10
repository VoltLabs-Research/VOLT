import { Button, Chip, Spinner, cn } from '@heroui/react';
import {
    TEAM_INVITATION_ACTIONS_CLASS,
    TEAM_INVITATION_ICON_ERROR_CLASS,
    TeamInvitationCard,
    TeamInvitationDetailItem,
    TeamInvitationDetails,
    TeamInvitationStateCard
} from '@/modules/team/components/TeamInvitationShared';
import {
    clearPostAuthDestination,
    getOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { useJoinByCodeMutation, usePreviewJoinByCodeQuery } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { AlertCircle, CheckCircle, ShieldCheck, Users, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

/**
 * `.team-invitation-by-code-icon` and its two tones. `--color-brand-primary` is
 * HeroUI's `--accent`, so the 10% `color-mix` fill is `bg-accent/10`; the ready tone's
 * `--status-success` / `--status-success-bg` pair is `text-success bg-success-soft`.
 */
const BY_CODE_ICON_CLASS = 'flex size-16 items-center justify-center rounded-full';
const BY_CODE_ICON_LOADING_CLASS = 'text-accent bg-accent/10';
const BY_CODE_ICON_READY_CLASS = 'text-success bg-success-soft';

const isAlreadyMemberError = (message: string): boolean => {
    return message.toLowerCase().includes('already a member');
};

const TeamInvitationByCodeTemplate = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const joinByCodeMutation = useJoinByCodeMutation();
    const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);
    const normalizedCode = code?.trim().toUpperCase() ?? '';
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

    const isAlreadyMember = Boolean(preview?.isAlreadyMember) || isAlreadyMemberError(joinErrorMessage ?? '');
    const hasError = !isAlreadyMember && Boolean(!normalizedCode || previewErrorMessage || joinErrorMessage);
    const isPreparing = previewQuery.isLoading || (!isAlreadyMember && !hasError && joinByCodeMutation.isPending);

    if (isPreparing) {
        const isJoining = joinByCodeMutation.isPending;

        return (
            <TeamInvitationStateCard
                icon={(
                    <div className={cn(BY_CODE_ICON_CLASS, BY_CODE_ICON_LOADING_CLASS)}>
                        <Spinner size='lg' color='current' />
                    </div>
                )}
                title={isJoining ? 'Joining team...' : 'Reviewing invite...'}
                description={isJoining
                    ? 'We are confirming your membership and preparing your workspace.'
                    : 'We are checking the invite details before you join the team.'}
            />
        );
    }

    if (isAlreadyMember) {
        return (
            <TeamInvitationCard>
                <Chip color='success' variant='soft' size='md'>
                    <Users size={20} aria-hidden='true' />
                    <Chip.Label>Already joined</Chip.Label>
                </Chip>
                <h3 className='text-xl font-semibold text-foreground'>You are already in this team</h3>
                {preview && (
                    <TeamInvitationDetails>
                        <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                        <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    </TeamInvitationDetails>
                )}
                <p className='text-muted'>
                    {joinErrorMessage || 'You already have access to this team. Continue to your dashboard when you are ready.'}
                </p>
                <Button
                    variant='primary'
                    onPress={handleNavigateToNextDestination}
                >
                    <CheckCircle size={18} aria-hidden='true' />
                    Go to Dashboard
                </Button>
            </TeamInvitationCard>
        );
    }

    if (hasError) {
        return (
            <TeamInvitationStateCard
                icon={(
                    <div className={TEAM_INVITATION_ICON_ERROR_CLASS}>
                        <XCircle size={48} />
                    </div>
                )}
                title='Could not join this team'
                description={joinErrorMessage || previewErrorMessage || 'This invite link is invalid or has expired.'}
                action={(
                    <Button
                        variant='primary'
                        onPress={handleNavigateToNextDestination}
                    >
                        Back to Dashboard
                    </Button>
                )}
            >
                <Chip color='danger' variant='soft' size='md'>
                    <AlertCircle size={16} aria-hidden='true' />
                    <Chip.Label>Please ask for a new invite link or try again later.</Chip.Label>
                </Chip>
            </TeamInvitationStateCard>
        );
    }

    return (
        <TeamInvitationCard>
            <div className={cn(BY_CODE_ICON_CLASS, BY_CODE_ICON_READY_CLASS)}>
                <ShieldCheck size={40} />
            </div>
            <h3 className='text-xl font-semibold text-foreground'>Join this team?</h3>
            <p className='text-muted'>
                Review the invite details below, then confirm to join this workspace.
            </p>
            {preview && (
                <TeamInvitationDetails>
                    <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                    <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    <TeamInvitationDetailItem label='Invite code' value={normalizedCode} />
                </TeamInvitationDetails>
            )}
            <div className={cn('flex flex-row items-center gap-3', TEAM_INVITATION_ACTIONS_CLASS)}>
                <Button variant='ghost' onPress={handleNavigateToNextDestination}>
                    Cancel
                </Button>
                <Button
                    variant='primary'
                    onPress={handleJoinTeam}
                >
                    <CheckCircle size={18} aria-hidden='true' />
                    Join Team
                </Button>
            </div>
        </TeamInvitationCard>
    );
};

export default TeamInvitationByCodeTemplate;
