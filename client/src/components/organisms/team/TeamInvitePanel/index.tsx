import React, { useState, useRef, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdContentCopy } from 'react-icons/md';
import { MdPublic } from 'react-icons/md';
import { IoBook } from 'react-icons/io5';
import { IoCheckmark } from 'react-icons/io5';
import { Skeleton } from '@mui/material';
import useToast from '@/hooks/ui/use-toast';
import Select from '@/components/atoms/form/Select';
import teamApi from '@/services/api/team';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';
import './TeamInvitePanel.css';

interface TeamMember {
    email: string;
    name?: string;
    role: 'Can view' | 'Full access' | 'Can edit';
    avatar?: string;
}

interface TeamInvitePanelProps {
    teamName: string;
    teamId: string;
    popoverId: string;
}

const TeamInvitePanel: React.FC<TeamInvitePanelProps> = ({
    teamId,
    popoverId
}) => {
    const [email, setEmail] = useState('');
    const [generalAccess, setGeneralAccess] = useState<'Can edit' | 'Can view' | 'Restricted'>('Restricted');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);
    const { showError, showSuccess } = useToast();

    useEffect(() => {
        const fetchMembers = async () => {
            if (!teamId) return;

            setLoadingMembers(true);
            try {
                const membersData = await teamApi.members.getAll(teamId);
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
    }, [teamId]);

    const handleAddMember = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
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

    return (
        <>
            <Container className='team-invite-header d-flex items-center content-between f-shrink-0'>
                <Container className='team-invite-tabs d-flex flex-1'>
                    <button className='team-invite-tab active'>Share</button>
                    <button className='team-invite-tab' style={{ opacity: 0.5, cursor: 'not-allowed' }}>Publish</button>
                </Container>
                <button
                    className='d-flex items-center content-center team-invite-close'
                    popoverTarget={popoverId}
                    popoverTargetAction="hide"
                    aria-label='Close'
                >
                    <IoClose size={20} />
                </button>
            </Container>

            <Container className='team-invite-content d-flex column flex-1'>
                <Container className='team-invite-input-section d-flex items-center gap-05'>
                    <input
                        autoFocus
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
                        className={`d-flex items-center content-center team-invite-invite-btn team-invite-invite-btn--${buttonState}`}
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
                </Container>

                <Container className='team-invite-members-section'>
                    {loadingMembers ? (
                        <>
                            {[1, 2, 3].map((i) => (
                                <Container key={i} className='team-invite-member-item' style={{ padding: '10px 20px' }}>
                                    <Container style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Skeleton variant='circular' width={36} height={36} />
                                        <Container>
                                            <Skeleton variant='text' width='8rem' height={20} sx={{ mb: 0.5 }} />
                                            <Skeleton variant='text' width='85%' height={16} />
                                        </Container>
                                    </Container>
                                    <Skeleton variant='rectangular' width={120} height={36} sx={{ borderRadius: '6px' }} />
                                </Container>
                            ))}
                        </>
                    ) : members.length === 0 ? (
                        <Container style={{ padding: '20px', textAlign: 'center', color: 'var(--invite-text-secondary)', fontSize: '13px' }}>
                            No members yet
                        </Container>
                    ) : (
                        members.map((member) => (
                            <Container key={member.email} className='d-flex items-center content-between gap-075 team-invite-member-item'>
                                <Container className='d-flex items-center gap-075 team-invite-member-info'>
                                    <Container
                                        className='d-flex items-center content-center team-invite-avatar'
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
                                    </Container>
                                    <Container className='team-invite-member-details'>
                                        <Paragraph className='team-invite-member-name'>{member.name || member.email}</Paragraph>
                                        {member.name && member.name !== member.email && <Paragraph className='team-invite-member-email'>{member.email}</Paragraph>}
                                    </Container>
                                </Container>
                                <Container className='d-flex items-center gap-05 team-invite-member-role'>
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
                                </Container>
                            </Container>
                        ))
                    )}
                </Container>

                <Container className='team-invite-general-access'>
                    <Container className='team-invite-general-header'>
                        <Title className='font-size-1 team-invite-general-title'>General Access</Title>
                    </Container>
                    <Container className='d-flex items-center gap-075 team-invite-general-item'>
                        <Container className='d-flex items-center content-center team-invite-general-icon'>
                            <MdPublic size={18} />
                        </Container>
                        <Container className='team-invite-general-info'>
                            <Paragraph className='team-invite-general-name'>Anyone with the link</Paragraph>
                        </Container>
                        <Select
                            options={[
                                { value: 'Restricted', title: 'Restricted' },
                                { value: 'Can view', title: 'Can view' },
                                { value: 'Can edit', title: 'Can edit' }
                            ]}
                            value={generalAccess}
                            style={{ width: 150 }}
                            onChange={(value) => setGeneralAccess(value as 'Can edit' | 'Can view' | 'Restricted')}
                            className='team-invite-general-select'
                            renderInPortal={true}
                        />
                    </Container>
                </Container>

                <Container className='team-invite-footer d-flex gap-05 content-between f-shrink-0'>
                    <button className='d-flex items-center gap-05 team-invite-footer-link'>
                        <MdContentCopy size={16} /> Copy link
                    </button>
                    <button className='d-flex items-center gap-05 team-invite-footer-link'>
                        <IoBook size={16} /> Learn more
                    </button>
                </Container>
            </Container>
        </>
    );
};

export default TeamInvitePanel;
