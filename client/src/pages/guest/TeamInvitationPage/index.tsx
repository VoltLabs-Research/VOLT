/**
* Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';
import { Skeleton } from '@mui/material';
import teamApi from '@/services/api/team';
import type { TeamInvitation } from '@/types/team-invitation';
import './TeamInvitationPage.css';

/* Add these styles to TeamInvitationPage.css if not present, or create the file */
/*
    .invited-by {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
    color: var(--text-secondary);
}

    .inviter-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

    .inviter-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

    .inviter-initials {
    color: white;
    font-weight: 600;
    font-size: 14px;
}
*/

const TeamInvitationPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchInvitation = async() => {
            try{
                const details = await teamApi.invitations.getDetails(token!);
                setInvitation(details as unknown as TeamInvitation);
            }catch(err: any){
                setError(err?.message || 'An error occurred');
            }finally{
                setLoading(false);
            }
        };

        if(token){
            fetchInvitation();
        }
    }, [token]);

    const handleAccept = async() => {
        if(!token) return;

        setActionLoading(true);
        try{
            await teamApi.invitations.accept(token);

            setError(null);
            // Redirect to dashboard after success
            setTimeout(() => {
                navigate(`/dashboard?team=${invitation?.team._id}`);
            }, 2000);
        }catch(err: any){
            setError(err?.message || 'An error occurred');
        }finally{
            setActionLoading(false);
        }
    };

    const handleReject = async() => {
        if(!token) return;

        setActionLoading(true);
        try{
            await teamApi.invitations.reject(token);

            setError(null);
            // Redirect to dashboard after success
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        }catch(err: any){
            setError(err?.message || 'An error occurred');
        }finally{
            setActionLoading(false);
        }
    };

    if(loading){
        return(
            <div className='team-invitation-page'>
                <div className='team-invitation-container'>
                    <Skeleton variant='rectangular' width={150} height={30} sx={{ borderRadius: '100px', mb: 2.5, mx: 'auto' }} />
                    <Skeleton variant='rectangular' width='80%' height={56} sx={{ borderRadius: '12px', mb: 2, mx: 'auto' }} />
                    <Skeleton variant='text' width='70%' height={28} sx={{ borderRadius: '8px', mb: 1, mx: 'auto' }} />
                    <Skeleton variant='text' width='50%' height={24} sx={{ borderRadius: '8px', mb: 6, mx: 'auto' }} />
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '48px', justifyContent: 'center' }}>
                        <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                        <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                        <Skeleton variant='rectangular' width={120} height={60} sx={{ borderRadius: '8px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <Skeleton variant='rectangular' width={180} height={46} sx={{ borderRadius: '12px' }} />
                        <Skeleton variant='rectangular' width={180} height={46} sx={{ borderRadius: '12px' }} />
                    </div>
                </div>
            </div>
        );
    }

    if(error || !invitation){
        return(
            <div className='team-invitation-page'>
                <div className='team-invitation-container error'>
                    <IoCloseCircle size={64} className='error-icon' />
                    <h1>Invalid Invitation</h1>
                    <p>{error || 'This invitation is not valid or has expired'}</p>
                    <button className='back-btn' onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired = new Date() > expiresAt;

    if(isExpired){
        return(
            <div className='team-invitation-page'>
                <div className='team-invitation-container error'>
                    <IoCloseCircle size={64} className='error-icon' />
                    <h1>Invitation Expired</h1>
                    <p>This invitation expired on {expiresAt.toLocaleString()}</p>
                    <button className='back-btn' onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return(
        <div className='team-invitation-page'>
            <div className='team-invitation-container'>
                <div className='team-invitation-header'>
                    <div className='welcome-badge'>You've been invited!</div>
                    <h1>{invitation.team.name}</h1>
                    <p className='subtitle'>
                        {invitation.team.description || 'Join this team to start collaborating on projects together.'}
                    </p>
                    <p className='invited-by'>
                        Invited by <strong>{invitation.invitedBy.email}</strong>
                    </p>
                </div>

                <div className='team-invitation-content'>
                    <div className='team-details'>
                        <div className='detail-item'>
                            <span className='label'>Your Role</span>
                            <span className='value role-badge'>{invitation.role}</span>
                        </div>
                        <div className='detail-item'>
                            <span className='label'>Team Members</span>
                            <span className='value'>
                                {invitation.team.memberCount || 0} {invitation.team.memberCount === 1 ? 'member' : 'members'}
                            </span>
                        </div>
                        <div className='detail-item'>
                            <span className='label'>Expires</span>
                            <span className='value'>
                                {expiresAt.toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>

                    <div className='invitation-actions'>
                        <button
                            className='action-btn accept-btn'
                            onClick={handleAccept}
                            disabled={actionLoading}
                        >
                            <IoCheckmarkCircle size={20} />
                            {actionLoading ? 'Accepting...' : 'Accept Invitation'}
                        </button>
                        <button
                            className='action-btn reject-btn'
                            onClick={handleReject}
                            disabled={actionLoading}
                        >
                            <IoCloseCircle size={20} />
                            {actionLoading ? 'Rejecting...' : 'Reject Invitation'}
                        </button>
                    </div>

                    {error && (
                        <div className='error-message'>
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamInvitationPage;
