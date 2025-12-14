import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IoCheckmarkCircle, IoCloseCircle, IoAlertCircle, IoTimeOutline } from 'react-icons/io5';
import { Skeleton } from '@mui/material';
import teamApi from '@/services/api/team';
import type { TeamInvitation } from '@/types/team-invitation';
import Button from '@/components/atoms/common/Button';
import EmptyState from '@/components/atoms/common/EmptyState';
import Container from '@/components/primitives/Container';
import '../SignIn/SignIn.css';
import './TeamInvitationPage.css';

const TeamInvitationPage: React.FC = () => {
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
            <Container className='auth-page-wrapper'>
                <Container className='form-section'>
                    <Container className='form-container d-flex column skeleton-details'>
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
            <Container className='auth-page-wrapper'>
                <Container className='form-section'>
                    <EmptyState
                        icon={<IoCloseCircle size={48} />}
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
            <Container className='auth-page-wrapper'>
                <Container className='form-section'>
                    <EmptyState
                        icon={<IoTimeOutline size={48} />}
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
        <Container className='auth-page-wrapper'>
            <Container className='form-section'>
                <Container className='form-container text-center'>
                    <Container className='form-header'>
                        <Container className='user-badge d-flex flex-center invitation-badge'>
                            <IoAlertCircle size={20} color='var(--color-zinc-400)' />
                            <span className='invitation-badge-text'>You've been invited!</span>
                        </Container>
                        <h1 className='mt-3 form-title'>{invitation.team.name}</h1>
                        <p className='form-subtitle'>
                            {invitation.team.description || 'Join this team to start collaborating on projects together.'}
                        </p>
                        <p className='invited-by'>
                            Invited by <strong>{invitation.invitedBy.email}</strong>
                        </p>
                    </Container>

                    <Container className='d-flex gap-1 flex-center flex-wrap invitation-details'>
                        <Container className='detail-item'>
                            <span className='detail-label'>Your Role</span>
                            <Container className='user-badge role-badge'>{invitation.role}</Container>
                        </Container>
                        <Container className='detail-item'>
                            <span className='detail-label'>Team Members</span>
                            <p className='detail-value'>
                                {invitation.team.memberCount || 0} {invitation.team.memberCount === 1 ? 'member' : 'members'}
                            </p>
                        </Container>
                        <Container className='detail-item'>
                            <span className='detail-label'>Expires</span>
                            <p className='detail-value'>
                                {expiresAt.toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </Container>
                    </Container>

                    <Container className='space-y-4 invitation-actions'>
                        <Button
                            className='btn btn-primary'
                            onClick={handleAccept}
                            disabled={actionLoading}
                            isLoading={actionLoading}
                        >
                            <IoCheckmarkCircle size={20} className='btn-icon' />
                            Accept Invitation
                        </Button>
                        <Button
                            className='btn btn-outline'
                            onClick={handleReject}
                            disabled={actionLoading}
                        >
                            <IoCloseCircle size={20} className='btn-icon' />
                            Reject Invitation
                        </Button>
                    </Container>

                    {error && (
                        <Container className='user-badge error-badge'>{error}</Container>
                    )}
                </Container>
            </Container>
        </Container>
    );
};

export default TeamInvitationPage;
