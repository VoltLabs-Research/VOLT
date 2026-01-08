import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import teamApi from '@/features/team/api/team';
import type { TeamInvitation } from '@/types/models';
import Button from '@/components/primitives/Button';
import EmptyState from '@/components/atoms/common/EmptyState';
import Container from '@/components/primitives/Container';
import useToast from '@/hooks/ui/use-toast';
import { useAuthStore } from '@/features/auth/stores';
import { CheckCircle, XCircle, Mail, Clock } from 'lucide-react';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import '../../../features/auth/pages/guest/SignIn/SignIn.css';
import './TeamInvitationPage.css';

const TeamInvitationPage: React.FC = () => {
    usePageTitle('Team Invitation');
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchInvitation = async () => {
            try {
                const details = await teamApi.invitations.getDetails(token!);
                setInvitation(details);
            } catch (err: any) {
                setError(err?.message || 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchInvitation();
        }
    }, [token]);

    const handleAccept = async () => {
        if (!token) return;

        setActionLoading(true);
        try {
            await teamApi.invitations.accept(token);
            setError(null);
            setTimeout(() => {
                navigate(`/dashboard?team=${invitation?.team._id}`);
            }, 2000);
        } catch (err: any) {
            setError(err?.message || 'An error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!token) return;

        setActionLoading(true);
        try {
            await teamApi.invitations.reject(token);
            setError(null);
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        } catch (err: any) {
            setError(err?.message || 'An error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <Container className='auth-page-wrapper w-max vh-max overflow-hidden'>
                <Container className='form-section p-relative gap-1 vh-max p-1-5'>
                    <Container className='form-container d-flex column gap-1-5 skeleton-details p-relative w-max'>
                        <Skeleton variant='rectangular' width={150} height={30} sx={{ borderRadius: '100px', mx: 'auto' }} />
                        <Skeleton variant='rectangular' width='80%' height={56} sx={{ borderRadius: '12px', mx: 'auto' }} />
                        <Skeleton variant='text' width='70%' height={28} sx={{ borderRadius: '8px', mx: 'auto' }} />
                        <Skeleton variant='text' width='50%' height={24} sx={{ borderRadius: '8px', mx: 'auto' }} />
                        <Container className='d-flex flex-center gap-1-5'>
                            <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                            <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                            <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                        </Container>
                        <Container className='d-flex flex-center gap-1'>
                            <Skeleton variant='rectangular' width={180} height={46} sx={{ borderRadius: '12px' }} />
                            <Skeleton variant='rectangular' width={180} height={46} sx={{ borderRadius: '12px' }} />
                        </Container>
                    </Container>
                </Container>
            </Container>
        );
    }

    if (error || !invitation || !invitation.team || !invitation.invitedBy) {
        return (
            <Container className='auth-page-wrapper w-max vh-max overflow-hidden'>
                <Container className='form-section p-relative gap-1 vh-max p-1-5'>
                    <EmptyState
                        icon={<XCircle size={48} />}
                        title='Invalid Invitation'
                        description={error || 'This invitation is not valid or has expired'}
                        buttonText='Back to Dashboard'
                        buttonOnClick={() => navigate('/dashboard')}
                    />
                </Container>
            </Container>
        );
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired = new Date() > expiresAt;

    if (isExpired) {
        return (
            <Container className='auth-page-wrapper w-max vh-max overflow-hidden'>
                <Container className='form-section p-relative gap-1 vh-max p-1-5'>
                    <EmptyState
                        icon={<Clock size={48} />}
                        title='Invitation Expired'
                        description={`This invitation expired on ${expiresAt.toLocaleString()}`}
                        buttonText='Back to Dashboard'
                        buttonOnClick={() => navigate('/dashboard')}
                    />
                </Container>
            </Container>
        );
    }

    return (
        <Container className='auth-page-wrapper w-max vh-max overflow-hidden'>
            <Container className='form-section p-relative gap-1 vh-max p-1-5'>
                <Container className='form-container text-center p-relative w-max'>
                    <Container className='form-header'>
                        <Container className='user-badge d-flex flex-center gap-05 invitation-badge p-1'>
                            <CheckCircle size={20} color='var(--color-zinc-400)' />
                            <span className='invitation-badge-text'>You've been invited!</span>
                        </Container>
                        <Title className='mt-3 font-size-5 font-weight-6'>{invitation.team.name}</Title>
                        <Paragraph className='form-subtitle font-size-3'>
                            You've been invited to join this team
                        </Paragraph>
                        <Paragraph className='invited-by'>
                            Invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                        </Paragraph>
                    </Container>

                    <Container className='d-flex gap-1 flex-center flex-wrap invitation-details'>
                        <Container className='detail-item text-center'>
                            <span className='detail-label'>Your Role</span>
                            <Container className='user-badge role-badge p-1'>{invitation.role}</Container>
                        </Container>
                        <Container className='detail-item text-center'>
                            <span className='detail-label'>Email</span>
                            <Paragraph className='detail-value font-size-3'>
                                <Mail size={14} style={{ marginRight: '0.5rem' }} />
                                {invitation.email}
                            </Paragraph>
                        </Container>
                        <Container className='detail-item text-center'>
                            <span className='detail-label'>Invited:</span>
                            <Paragraph className='detail-value font-size-3'>
                                <Clock size={14} style={{ marginRight: '0.5rem' }} />
                                {new Date(invitation.createdAt).toLocaleDateString()}
                            </Paragraph>
                        </Container>
                        <Container className='detail-item text-center'>
                            <span className='detail-label'>Expires</span>
                            <Paragraph className='detail-value font-size-3'>
                                {expiresAt.toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Paragraph>
                        </Container>
                    </Container>

                    <Container className='space-y-4 invitation-actions'>
                        <Button
                            variant='solid'
                            intent='white'
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
                            intent='white'
                            block
                            leftIcon={<XCircle size={20} />}
                            onClick={handleReject}
                            disabled={actionLoading}
                        >
                            Reject Invitation
                        </Button>
                    </Container>

                    {error && (
                        <Container className='user-badge error-badge p-1'>{error}</Container>
                    )}
                </Container>
            </Container>
        </Container>
    );
};

export default TeamInvitationPage;
