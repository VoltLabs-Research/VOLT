import { Button, Tag, Loader, Row, Heading, Text } from '@voltstack/bravais';
import {
    TeamInvitationCard,
    TeamInvitationDetailItem,
    TeamInvitationDetails,
    TeamInvitationStateCard
} from '@/modules/team/components/TeamInvitationShared';
import './TeamInvitationByCode.css';
import '../TeamInvitation/TeamInvitation.css';
import {
    clearPostAuthDestination,
    getOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { useJoinByCodeMutation, usePreviewJoinByCodeQuery } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { AlertCircle, CheckCircle, ShieldCheck, Users, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import type { Params } from 'react-router-dom';
interface TeamInvitationByCodeRouteParams extends Params {
    code: string;
}

enum TeamInvitationByCodeStatus {
    Ready = 'ready',
    Joining = 'joining',
    AlreadyMember = 'already-member',
    Error = 'error'
}

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
            <TeamInvitationStateCard
                icon={(
                    <div className='team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <Loader scale={1} isFixed={false} />
                    </div>
                )}
                title='Reviewing invite...'
                description='We are checking the invite details before you join the team.'
            />
        );
    }

    if (status === TeamInvitationByCodeStatus.Joining) {
        return (
            <TeamInvitationStateCard
                icon={(
                    <div className='team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <Loader scale={1} isFixed={false} />
                    </div>
                )}
                title='Joining team...'
                description='We are confirming your membership and preparing your workspace.'
            />
        );
    }

    if (status === TeamInvitationByCodeStatus.AlreadyMember) {
        return (
            <TeamInvitationCard>
                <Tag tone='success' variant='soft' size='md' leftIcon={<Users size={20} />}>
                    Already joined
                </Tag>
                <Heading level={3} size='xl' weight='bold'>You are already in this team</Heading>
                {preview && (
                    <TeamInvitationDetails>
                        <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                        <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    </TeamInvitationDetails>
                )}
                <Text as='p' tone='secondary'>
                    {joinErrorMessage || 'You already have access to this team. Continue to your dashboard when you are ready.'}
                </Text>
                <Button
                    variant='solid'
                    intent='brand'
                    leftIcon={<CheckCircle size={18} />}
                    onClick={handleNavigateToNextDestination}
                >
                    Go to Dashboard
                </Button>
            </TeamInvitationCard>
        );
    }

    if (status === TeamInvitationByCodeStatus.Error) {
        return (
            <TeamInvitationStateCard
                icon={(
                    <div className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </div>
                )}
                title='Could not join this team'
                description={joinErrorMessage || previewErrorMessage || 'This invite link is invalid or has expired.'}
                action={(
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleNavigateToNextDestination}
                    >
                        Back to Dashboard
                    </Button>
                )}
            >
                <Tag tone='danger' variant='soft' size='md' leftIcon={<AlertCircle size={16} />}>
                    Please ask for a new invite link or try again later.
                </Tag>
            </TeamInvitationStateCard>
        );
    }

    return (
        <TeamInvitationCard>
            <div className='team-invitation-by-code-icon team-invitation-by-code-icon-ready'>
                <ShieldCheck size={40} />
            </div>
            <Heading level={3} size='xl' weight='bold'>Join this team?</Heading>
            <Text as='p' tone='secondary'>
                Review the invite details below, then confirm to join this workspace.
            </Text>
            {preview && (
                <TeamInvitationDetails>
                    <TeamInvitationDetailItem label='Team' value={preview.teamName} />
                    <TeamInvitationDetailItem label='Owner' value={preview.ownerName} />
                    <TeamInvitationDetailItem label='Invite code' value={normalizedCode} />
                </TeamInvitationDetails>
            )}
            <Row gap='075' className='team-invitation-actions'>
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
            </Row>
        </TeamInvitationCard>
    );
};

export default TeamInvitationByCodeTemplate;
