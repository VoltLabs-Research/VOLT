/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import React, { useState, useRef, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdContentCopy } from 'react-icons/md';
import { MdPublic } from 'react-icons/md';
import { IoBook } from 'react-icons/io5';
import usePositioning from '@/hooks/ui/positioning/use-positioning';
import Select from '@/components/atoms/form/Select';
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
    triggerRef?: React.RefObject<HTMLDivElement>;
}

const TeamInvitePanel: React.FC<TeamInvitePanelProps> = ({
    isOpen,
    onClose,
    teamName,
    triggerRef
}) => {
    const [email, setEmail] = useState('');
    const [generalAccess, setGeneralAccess] = useState<'Can edit' | 'Can view' | 'Restricted'>('Can edit');
    const [members, setMembers] = useState<TeamMember[]>([
        { email: 'rodolfo.herrera@alumnos.ucm.cl', name: 'Rodolfo Herrera (You)', role: 'Full access', avatar: 'R' }
    ]);
    const panelRef = useRef<HTMLDivElement>(null);
    
    // Use positioning hook for intelligent positioning
    const { styles, setInitialPosition } = usePositioning(
        triggerRef,
        panelRef,
        isOpen
    );

    // Initialize position when panel opens
    useEffect(() => {
        if (isOpen) {
            setInitialPosition();
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

    const handleAddMember = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && email.trim()) {
            e.preventDefault();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(email.trim())) {
                if (!members.find(m => m.email === email.trim())) {
                    setMembers([...members, { email: email.trim(), role: 'Can view' }]);
                    setEmail('');
                }
            }
        }
    };

    const handleRemoveMember = (emailToRemove: string) => {
        setMembers(members.filter(m => m.email !== emailToRemove));
    };

    const handleRoleChange = (email: string, newRole: 'Can view' | 'Full access' | 'Can edit') => {
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
                    <button className='team-invite-tab'>Publish</button>
                </div>
                <button className='team-invite-close' onClick={onClose}>
                    <IoClose size={18} />
                </button>
            </div>

            {/* Content */}
            <div className='team-invite-content'>
                {/* Input Section */}
                <div className='team-invite-input-section'>
                    <input
                        type='email'
                        placeholder='Email or group, separated by commas'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleAddMember}
                        className='team-invite-search-input'
                    />
                    <button className='team-invite-invite-btn'>Invite</button>
                </div>

                {/* Members List */}
                <div className='team-invite-members-section'>
                    {members.map((member) => (
                        <div key={member.email} className='team-invite-member-item'>
                            <div className='team-invite-member-info'>
                                <div 
                                    className='team-invite-avatar'
                                    style={{ backgroundColor: getAvatarColor(member.email) }}
                                >
                                    {member.avatar || getInitials(member.email)}
                                </div>
                                <div className='team-invite-member-details'>
                                    <p className='team-invite-member-name'>{member.name || member.email}</p>
                                    {member.name && <p className='team-invite-member-email'>{member.email}</p>}
                                </div>
                            </div>
                            <div className='team-invite-member-role'>
                                <Select
                                    options={[
                                        { value: 'Can view', title: 'Can view' },
                                        { value: 'Can edit', title: 'Can edit' },
                                        { value: 'Full access', title: 'Full access' }
                                    ]}
                                    value={member.role}
                                    onChange={(value) => handleRoleChange(member.email, value as 'Can view' | 'Full access' | 'Can edit')}
                                    className='team-invite-role-select'
                                    maxListWidth={150}
                                />
                                {member.email !== members[0].email && (
                                    <button 
                                        className='team-invite-remove-btn'
                                        onClick={() => handleRemoveMember(member.email)}
                                    >
                                        <IoClose size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* General Access */}
                <div className='team-invite-general-access'>
                    <div className='team-invite-general-header'>
                        <h4 className='team-invite-general-title'>General access</h4>
                    </div>
                    <div className='team-invite-general-item'>
                        <div className='team-invite-general-icon'>
                            <MdPublic size={20} />
                        </div>
                        <div className='team-invite-general-info'>
                            <p className='team-invite-general-name'>Anyone on the web with link</p>
                        </div>
                        <Select
                            options={[
                                { value: 'Can edit', title: 'Can edit' },
                                { value: 'Can view', title: 'Can view' },
                                { value: 'Restricted', title: 'Restricted' }
                            ]}
                            value={generalAccess}
                            onChange={(value) => setGeneralAccess(value as 'Can edit' | 'Can view' | 'Restricted')}
                            className='team-invite-general-select'
                            maxListWidth={150}
                        />
                    </div>
                </div>

                {/* Footer Links */}
                <div className='team-invite-footer'>
                    <button className='team-invite-footer-link'>
                        <IoBook size={16} /> Learn about sharing
                    </button>
                    <button className='team-invite-footer-link'>
                        <MdContentCopy size={16} /> Copy link
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamInvitePanel;


