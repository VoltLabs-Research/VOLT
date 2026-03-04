import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Mail, Clock, AlertCircle } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import useTeamInvitationUseCases from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-use-cases';
import type { TeamInvitation } from '@/modules/team/domain/entities/TeamInvitation';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';
import './TeamInvitation.css';

const TeamInvitationTemplate: React.FC = () => {
    const { invitationId } = useParams<{ invitationId: string }>();
    const navigate = useNavigate();
    const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const { teamInvitationRepository } = useTeamInvitationUseCases();

    const fetchInvitation = async () => {
        if(!invitationId) {
            setError('Invalid invitation link');
            setLoading(false);
            return;
        }

        try{
            const details = await teamInvitationRepository.getDetails(invitationId);
            setInvitation(details);
        }catch(err: unknown){
            if(ApiError.isRBACError(err)){
                setError(err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to perform this action.');
            } else {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        }finally{
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitation();
    }, [invitationId, teamInvitationRepository]);

    const handleAccept = async () => {
        if(!invitationId || !invitation) return;

        setActionLoading(true);
        try{
            localStorage.setItem('selectedTeamId', invitation.team._id);
            await showPromise(teamInvitationRepository.accept(invitationId), {
                loading: { title: 'Accepting invitation...' },
                success: { title: 'Invitation accepted!' },
                error: { title: 'Failed to accept invitation' }
            });
            setError(null);
            window.location.href = '/dashboard';
        }catch(err: unknown){
            if(ApiError.isRBACError(err)){
                setError(err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to perform this action.');
            } else {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        }finally{
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if(!invitationId) return;

        setActionLoading(true);
        try{
            await showPromise(teamInvitationRepository.reject(invitationId), {
                loading: { title: 'Rejecting invitation...' },
                success: { title: 'Invitation rejected' },
                error: { title: 'Failed to reject invitation' }
            });
            setError(null);
            window.location.href = '/dashboard';
        }catch(err: unknown){
            if(ApiError.isRBACError(err)){
                setError(err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to perform this action.');
            } else {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        }finally{
            setActionLoading(false);
        }
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

    if(error || !invitation || !invitation.team || !invitation.invitedBy){
        return (
            <Container className='team-invitation-page w-max vh-max d-flex items-center content-center'>
                <Container className='team-invitation-card radius-lg d-flex column gap-1-5 items-center text-center'>
                    <Container className='team-invitation-icon-error'>
                        <XCircle size={48} />
                    </Container>
                    <Title className='font-size-4 font-weight-6'>Invalid Invitation</Title>
                    <Paragraph className='color-secondary'>
                        {error || 'This invitation is not valid or has expired'}
                    </Paragraph>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={() => navigate('/dashboard')}
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
                        onClick={() => navigate('/dashboard')}
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
};

export default TeamInvitationTemplate;
