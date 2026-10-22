import { Button } from '@heroui/react';
import {
    TeamInvitationActions,
    TeamInvitationCard,
    TeamInvitationDetailItem,
    TeamInvitationDetails,
    TeamInvitationHeading,
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
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

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
                <TeamInvitationHeading
                    title='You are already in this team'
                    description={joinErrorMessage || 'You already have access to this team. Continue to your dashboard when you are ready.'}
                />
                {preview && (
                    <TeamInvitationDetails>
                        <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                        <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    </TeamInvitationDetails>
                )}
                <Button
                    variant='primary'
                    size='sm'
                    className='self-start'
                    onPress={handleNavigateToNextDestination}
                >
                    Go to Dashboard
                </Button>
            </TeamInvitationCard>
        );
    }

    if (hasError) {
        return (
            <TeamInvitationStateCard
                title='Could not join this team'
                description={`${joinErrorMessage || previewErrorMessage || 'This invite link is invalid or has expired.'} Please ask for a new invite link or try again later.`}
                action={(
                    <Button
                        variant='primary'
                        size='sm'
                        onPress={handleNavigateToNextDestination}
                    >
                        Back to Dashboard
                    </Button>
                )}
            />
        );
    }

    return (
        <TeamInvitationCard>
            <TeamInvitationHeading
                title='Join this team?'
                description='Review the invite details below, then confirm to join this workspace.'
            />
            {preview && (
                <TeamInvitationDetails>
                    <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                    <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    <TeamInvitationDetailItem label='Invite code' value={normalizedCode} valueClassName='font-mono tracking-[0.18em]' />
                </TeamInvitationDetails>
            )}
            <TeamInvitationActions>
                <Button variant='secondary' fullWidth onPress={handleNavigateToNextDestination}>
                    Cancel
                </Button>
                <Button
                    variant='primary'
                    fullWidth
                    onPress={handleJoinTeam}
                >
                    Join Team
                </Button>
            </TeamInvitationActions>
        </TeamInvitationCard>
    );
};

export default TeamInvitationByCodeTemplate;
