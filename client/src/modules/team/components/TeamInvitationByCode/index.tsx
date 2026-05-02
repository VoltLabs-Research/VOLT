import Button from '@/shared/presentation/primitives/Button';
import Tag from '@/shared/presentation/primitives/Tag';
import Loader from '@/shared/presentation/primitives/Loader';
import Stack from '@/shared/presentation/primitives/Stack';
import Row from '@/shared/presentation/primitives/Row';
import Heading from '@/shared/presentation/primitives/Heading';
import Text from '@/shared/presentation/primitives/Text';
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
            <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
                <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                    <div className='team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <Loader scale={1} isFixed={false} />
                    </div>
                    <Heading level={3} size='xl' weight='bold'>Reviewing invite...</Heading>
                    <Text as='p' tone='secondary'>
                        We are checking the invite details before you join the team.
                    </Text>
                </Stack>
            </Stack>
        );
    }

    if (status === TeamInvitationByCodeStatus.Joining) {
        return (
            <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
                <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                    <div className='team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <Loader scale={1} isFixed={false} />
                    </div>
                    <Heading level={3} size='xl' weight='bold'>Joining team...</Heading>
                    <Text as='p' tone='secondary'>
                        We are confirming your membership and preparing your workspace.
                    </Text>
                </Stack>
            </Stack>
        );
    }

    if (status === TeamInvitationByCodeStatus.AlreadyMember) {
        return (
            <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
                <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                    <Tag tone='success' variant='soft' size='md' leftIcon={<Users size={20} />}>
                        Already joined
                    </Tag>
                    <Heading level={3} size='xl' weight='bold'>You are already in this team</Heading>
                    {preview && (
                        <Row align='start' gap='1' wrap radius='md' className='team-invitation-details'>
                            <Stack className='team-invitation-detail'>
                                <Text as='span' className='team-invitation-detail-label'>Team</Text>
                                <Text as='span' className='team-invitation-detail-value'>{preview.teamName}</Text>
                            </Stack>
                            <Stack className='team-invitation-detail'>
                                <Text as='span' className='team-invitation-detail-label'>Owner</Text>
                                <Text as='span' className='team-invitation-detail-value'>{preview.ownerName}</Text>
                            </Stack>
                        </Row>
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
                </Stack>
            </Stack>
        );
    }

    if (status === TeamInvitationByCodeStatus.Error) {
        return (
            <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
                <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                    <div className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </div>
                    <Heading level={3} size='xl' weight='bold'>Could not join this team</Heading>
                    <Text as='p' tone='secondary'>
                        {joinErrorMessage || previewErrorMessage || 'This invite link is invalid or has expired.'}
                    </Text>
                    <Tag tone='danger' variant='soft' size='md' leftIcon={<AlertCircle size={16} />}>
                        Please ask for a new invite link or try again later.
                    </Tag>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleNavigateToNextDestination}
                    >
                        Back to Dashboard
                    </Button>
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
            <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                <div className='team-invitation-by-code-icon team-invitation-by-code-icon-ready'>
                    <ShieldCheck size={40} />
                </div>
                <Heading level={3} size='xl' weight='bold'>Join this team?</Heading>
                <Text as='p' tone='secondary'>
                    Review the invite details below, then confirm to join this workspace.
                </Text>
                {preview && (
                    <Row align='start' gap='1' wrap radius='md' className='team-invitation-details'>
                        <Stack className='team-invitation-detail'>
                            <Text as='span' className='team-invitation-detail-label'>Team</Text>
                            <Text as='span' className='team-invitation-detail-value'>{preview.teamName}</Text>
                        </Stack>
                        <Stack className='team-invitation-detail'>
                            <Text as='span' className='team-invitation-detail-label'>Owner</Text>
                            <Text as='span' className='team-invitation-detail-value'>{preview.ownerName}</Text>
                        </Stack>
                        <Stack className='team-invitation-detail'>
                            <Text as='span' className='team-invitation-detail-label'>Invite code</Text>
                            <Text as='span' className='team-invitation-detail-value'>{normalizedCode}</Text>
                        </Stack>
                    </Row>
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
            </Stack>
        </Stack>
    );
};

export default TeamInvitationByCodeTemplate;
