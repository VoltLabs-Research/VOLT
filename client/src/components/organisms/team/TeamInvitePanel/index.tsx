/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import React, { useState, useRef, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdContentCopy } from 'react-icons/md';
import { MdPublic } from 'react-icons/md';
import { IoBook } from 'react-icons/io5';
import { IoCheckmark } from 'react-icons/io5';
import { Skeleton } from '@mui/material';
import usePositioning from '@/hooks/ui/positioning/use-positioning';
import useToast from '@/hooks/ui/use-toast';
import Select from '@/components/atoms/form/Select';
import teamApi from '@/services/api/team';
import './TeamInvitePanel.css';

interface TeamMember {
    email: string;
    name?: string;
    role: 'Can view' | 'Full access' | 'Can edit';
    avatar?: string;
}

interface TeamInvitePanelProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    teamId: string;
    triggerRef?: React.RefObject<HTMLElement | null>;
}

const TeamInvitePanel: React.FC<TeamInvitePanelProps> = ({
    isOpen,
    onClose,
    teamId,
    triggerRef
}) => {
    const [email, setEmail] = useState('');
    const [generalAccess, setGeneralAccess] = useState<'Can edit' | 'Can view' | 'Restricted'>('Restricted');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showError, showSuccess } = useToast();

    // Use positioning hook for intelligent positioning
    const { styles, setInitialPosition } = usePositioning(
        triggerRef as React.RefObject<HTMLElement>,
        panelRef as React.RefObject<HTMLDivElement>,
        isOpen
    );

    // Fetch team members when panel opens
    useEffect(() => {
        const fetchMembers = async () => {
            if (!isOpen || !teamId) return;

            setLoadingMembers(true);
            try {
                const membersData = await teamApi.members.getAll(teamId);

                // Map members to the expected format
                const formattedMembers: TeamMember[] = (membersData as any[])?.map((member: any) => ({
                    email: member.email || member._id,
                    name: member.username || member.email,
                    role: 'Can edit',
                    avatar: member.avatar || member.username?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase()
                })) || [];

                setMembers(formattedMembers);
            } catch (err) {
                console.error('Error fetching team members:', err);
            } finally {
                setLoadingMembers(false);
            }
        };

        fetchMembers();
    }, [isOpen, teamId]);

    // Initialize position when panel opens
    useEffect(() => {
        if (isOpen) {
            setInitialPosition();
            // Auto-focus input when panel opens
            setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
        }
    }, [isOpen, setInitialPosition]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && !triggerRef.current.contains(event.target as Node)) {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    const handleAddMember = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
        // Handle both Enter key and button click
        if ('key' in e && e.key !== 'Enter') return;
        if ('key' in e) e.preventDefault();

        if (!email.trim()) return;

        setButtonState('idle');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            const errorMsg = 'Invalid email format';
            showError(errorMsg);
            setButtonState('error');
            setTimeout(() => setButtonState('idle'), 2000);
            return;
        }

        if (members.find(m => m.email === email.trim())) {
            const errorMsg = 'This email is already invited';
            showError(errorMsg);
            setButtonState('error');
            setTimeout(() => setButtonState('idle'), 2000);
            return;
        }

        setLoading(true);
        setButtonState('loading');
        try {
            await teamApi.invitations.send(teamId, email.trim(), 'Can view' as any);

            setMembers([...members, { email: email.trim(), role: 'Can view' }]);
            setEmail('');
            const successMsg = `Invitation sent to ${email.trim()}`;
            showSuccess(successMsg);
            setButtonState('success');

            setTimeout(() => {
                setButtonState('idle');
            }, 2500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            showError(errorMessage);
            setButtonState('error');
            setTimeout(() => setButtonState('idle'), 2000);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (emailToRemove: string) => {
        try {
            await teamApi.members.remove(teamId, { email: emailToRemove });

            setMembers(members.filter(m => m.email !== emailToRemove));
            showSuccess(`Member ${emailToRemove} removed successfully`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
            showError(errorMessage);
        }
    };

    const handleRoleChange = async (email: string, newRole: 'Can view' | 'Full access' | 'Can edit' | 'Remove') => {
        if (newRole === 'Remove') {
            handleRemoveMember(email);
            return;
        }

        setMembers(members.map(m =>
            m.email === email ? { ...m, role: newRole } : m
        ));
    };

    const getAvatarColor = (email: string) => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    const getInitials = (email: string) => {
        return email.split('@')[0].charAt(0).toUpperCase();
    };

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            className='team-invite-panel'
            style={styles as React.CSSProperties}
        >
            {/* Header */}
            <div className='team-invite-header'>
                <div className='team-invite-tabs'>
                    <button className='team-invite-tab active'>Share</button>
                    <button className='team-invite-tab' style={{ opacity: 0.5, cursor: 'not-allowed' }}>Publish</button>
                </div>
                <button className='team-invite-close' onClick={onClose} aria-label='Close'>
                    <IoClose size={20} />
                </button>
            </div>

            {/* Content */}
            <div className='team-invite-content'>
                {/* Input Section */}
                <div className='team-invite-input-section'>
                    <input
                        ref={inputRef}
                        type='email'
                        placeholder='Add people by email...'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleAddMember}
                        className='team-invite-search-input'
                        disabled={loading}
                    />
                    <button
                        className={`team-invite-invite-btn team-invite-invite-btn--${buttonState}`}
                        onClick={handleAddMember}
                        disabled={loading}
                    >
                        {buttonState === 'loading' && (
                            <>
                                <span className='team-invite-btn-spinner'></span>
                                <span>Sending...</span>
                            </>
                        )}
                        {buttonState === 'success' && (
                            <>
                                <IoCheckmark size={18} />
                                <span>Sent!</span>
                            </>
                        )}
                        {buttonState === 'error' && (
                            <>
                                <IoClose size={18} />
                                <span>Error</span>
                            </>
                        )}
                        {buttonState === 'idle' && 'Invite'}
                    </button>
                </div>

                {/* Members List */}
                <div className='team-invite-members-section'>
                    {loadingMembers ? (
                        <>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className='team-invite-member-item' style={{ padding: '10px 20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Skeleton variant='circular' width={36} height={36} />
                                        <div>
                                            <Skeleton variant='text' width='8rem' height={20} sx={{ mb: 0.5 }} />
                                            <Skeleton variant='text' width='85%' height={16} />
                                        </div>
                                    </div>
                                    <Skeleton variant='rectangular' width={120} height={36} sx={{ borderRadius: '6px' }} />
                                </div>
                            ))}
                        </>
                    ) : members.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--invite-text-secondary)', fontSize: '13px' }}>
                            No members yet
                        </div>
                    ) : (
                        members.map((member) => (
                            <div key={member.email} className='team-invite-member-item'>
                                <div className='team-invite-member-info'>
                                    <div
                                        className='team-invite-avatar'
                                        style={{ backgroundColor: member.avatar ? 'transparent' : getAvatarColor(member.email) }}
                                    >
                                        {member.avatar ? (
                                            <img
                                                src={member.avatar}
                                                alt={member.name || member.email}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                            />
                                        ) : (
                                            getInitials(member.email)
                                        )}
                                    </div>
                                    <div className='team-invite-member-details'>
                                        <p className='team-invite-member-name'>{member.name || member.email}</p>
                                        {member.name && member.name !== member.email && <p className='team-invite-member-email'>{member.email}</p>}
                                    </div>
                                </div>
                                <div className='team-invite-member-role'>
                                    <Select
                                        options={[
                                            { value: 'Can view', title: 'Can view' },
                                            { value: 'Can edit', title: 'Can edit' },
                                            { value: 'Full access', title: 'Full access' },
                                            { value: 'Remove', title: 'Remove' }
                                        ]}
                                        value={member.role}
                                        onChange={(value) => handleRoleChange(member.email, value as 'Can view' | 'Full access' | 'Can edit' | 'Remove')}
                                        className='team-invite-role-select'
                                        maxListWidth={150}
                                        renderInPortal={true}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* General Access */}
                <div className='team-invite-general-access'>
                    <div className='team-invite-general-header'>
                        <h4 className='team-invite-general-title'>General Access</h4>
                    </div>
                    <div className='team-invite-general-item'>
                        <div className='team-invite-general-icon'>
                            <MdPublic size={18} />
                        </div>
                        <div className='team-invite-general-info'>
                            <p className='team-invite-general-name'>Anyone with the link</p>
                        </div>
                        <Select
                            options={[
                                { value: 'Restricted', title: 'Restricted' },
                                { value: 'Can view', title: 'Can view' },
                                { value: 'Can edit', title: 'Can edit' }
                            ]}
                            value={generalAccess}
                            onChange={(value) => setGeneralAccess(value as 'Can edit' | 'Can view' | 'Restricted')}
                            className='team-invite-general-select'
                            maxListWidth={150}
                            renderInPortal={true}
                        />
                    </div>
                </div>

                {/* Footer Links */}
                <div className='team-invite-footer'>
                    <button className='team-invite-footer-link'>
                        <MdContentCopy size={16} /> Copy link
                    </button>
                    <button className='team-invite-footer-link'>
                        <IoBook size={16} /> Learn more
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamInvitePanel;


