import './TeamInvitationByCode.css';
import '../TeamInvitation/TeamInvitation.css';
import {
    clearPostAuthDestination,
    getOnboardingRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { useJoinByCodeMutation } from '@/modules/team/hooks/team/queries';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import { normalizeError } from '@/shared/errors/core';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, LoaderCircle, Users, XCircle } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Params } from 'react-router-dom';

interface TeamInvitationByCodeRouteParams extends Params {
    code: string;
};

enum TeamInvitationByCodeStatus {
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
    const hasAttemptedJoinRef = useRef(false);
    const [status, setStatus] = useState<TeamInvitationByCodeStatus>(TeamInvitationByCodeStatus.Joining);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });
    const handleNavigateToNextDestination = () => {
        navigate(getOnboardingRedirectPath(nextDestination));
    };

    useEffect(() => {
        if (!code) {
            clearPostAuthDestination();
            setStatus(TeamInvitationByCodeStatus.Error);
            setErrorMessage('Invalid invitation link');
            return;
        }

        if (hasAttemptedJoinRef.current) {
            return;
        }

        hasAttemptedJoinRef.current = true;

        const joinTeamByCode = async () => {
            try {
                const result = await joinByCodeMutation.mutateAsync({ code });

                switchSelectedTeam(result.teamId);
                await refreshSocketSession();
                clearPostAuthDestination();

                navigate(getOnboardingRedirectPath(nextDestination), { replace: true });
            } catch (error: unknown) {
                const friendlyMessage = normalizeError(error).friendlyMessage;

                if (isAlreadyMemberError(friendlyMessage)) {
                    clearPostAuthDestination();
                    setStatus(TeamInvitationByCodeStatus.AlreadyMember);
                    setErrorMessage('You are already a member of this team. You can continue to your dashboard.');
                    return;
                }

                clearPostAuthDestination();
                setStatus(TeamInvitationByCodeStatus.Error);
                setErrorMessage(friendlyMessage || 'This invite link is invalid or has expired.');
            }
        };

        joinTeamByCode();
    }, [code, joinByCodeMutation, navigate, nextDestination]);

    if (status === TeamInvitationByCodeStatus.Joining) {
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Container className='team-invitation-by-code-icon team-invitation-by-code-icon-loading'>
                        <LoaderCircle size={48} className='team-invitation-by-code-spinner' />
                    </Container>
                    <Title className='font-size-4 font-weight-6'>Joining team...</Title>
                    <Paragraph className='color-secondary'>
                        We are validating your invite link and preparing your workspace.
                    </Paragraph>
                </Container>
            </Container>
        );
    }

    if (status === TeamInvitationByCodeStatus.AlreadyMember) {
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Container className='team-invitation-badge radius-full d-flex items-center gap-05'>
                        <Users size={20} />
                        <span>Already joined</span>
                    </Container>
                    <Title className='font-size-4 font-weight-6'>You are already in this team</Title>
                    <Paragraph className='color-secondary'>
                        {errorMessage}
                    </Paragraph>
                    <Button
                        variant='solid'
                        intent='brand'
                        leftIcon={<CheckCircle size={18} />}
                        onClick={handleNavigateToNextDestination}
                    >
                        Go to Dashboard
                    </Button>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
            <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                <Container className='team-invitation-icon-error'>
                    <XCircle size={48} />
                </Container>
                <Title className='font-size-4 font-weight-6'>Could not join this team</Title>
                <Paragraph className='color-secondary'>
                    {errorMessage || 'This invite link is invalid or has expired.'}
                </Paragraph>
                <Container className='team-invitation-error radius-sm d-flex items-center gap-025'>
                    <AlertCircle size={16} />
                    Please ask for a new invite link or try again later.
                </Container>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={handleNavigateToNextDestination}
                >
                    Back to Dashboard
                </Button>
            </Container>
        </Container>
    );
};

export default TeamInvitationByCodeTemplate;
