/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { useChat } from '@/hooks/chat/useChat';
import { 
    IoPeopleOutline, 
    IoPersonAddOutline, 
    IoShieldOutline, 
    IoExitOutline,
    IoSettingsOutline,
    IoSearchOutline,
    IoArrowBackOutline,
    IoLockClosedOutline,
    IoStarOutline,
    IoCheckmarkCircleOutline,
    IoInformationCircleOutline
} from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';
import Draggable from '@/components/atoms/common/Draggable';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Button from '@/components/atoms/common/Button';
import FormInput from '@/components/atoms/form/FormInput';
import './GroupManagementModal.css';

const GroupManagementModal = () => {
    const { 
        currentChat, 
        setShowGroupManagement, 
        editGroupName,
        editGroupDescription,
        setEditGroupName,
        setEditGroupDescription,
        teamMembers,
        loadTeamMembers
    } = useChatStore();
    const { leaveGroup, updateGroupInfo, addUsersToGroup, updateGroupAdmins } = useChat();
    const user = useAuthStore((store) => store.user);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSection, setActiveSection] = useState<'general' | 'members' | 'administrators'>('members');
    
    // Add Members states
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    
    // Manage Admins states
    const [showManageAdmins, setShowManageAdmins] = useState(false);
    const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

    if (!currentChat || !currentChat.isGroup) return null;

    const isAdmin = currentChat.admins?.some(admin => admin._id === user?._id) || false;
    const isOwner = currentChat.createdBy?._id === user?._id;

    // Initialize form with current group data
    useEffect(() => {
        if (currentChat) {
            setEditGroupName(currentChat.groupName || '');
            setEditGroupDescription(currentChat.groupDescription || '');
        }
    }, [currentChat, setEditGroupName, setEditGroupDescription]);

    const handleLeaveGroup = async () => {
        if (!confirm('Are you sure you want to leave this group?')) return;
        
        setIsLoading(true);
        try {
            await leaveGroup(currentChat._id);
            setShowGroupManagement(false);
        } catch (error) {
            console.error('Failed to leave group:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-save when user stops typing
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (editGroupName.trim() && editGroupName !== currentChat?.groupName) {
                updateGroupInfo(
                    currentChat._id, 
                    editGroupName.trim(), 
                    editGroupDescription.trim()
                );
            }
        }, 1000); // 1 second delay

        return () => clearTimeout(timeoutId);
    }, [editGroupName, editGroupDescription, currentChat, updateGroupInfo]);

    // Add Members functions
    const handleAddMembers = () => {
        setShowAddMembers(true);
        if (currentChat?.team?._id) {
            loadTeamMembers(currentChat.team._id);
        }
    };

    const handleAddSelectedMembers = async () => {
        if (selectedMembers.length === 0) return;
        
        setIsLoading(true);
        try {
            await addUsersToGroup(currentChat!._id, selectedMembers);
            setSelectedMembers([]);
            setShowAddMembers(false);
        } catch (error) {
            console.error('Failed to add members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMemberSelection = (memberId: string) => {
        setSelectedMembers(prev => 
            prev.includes(memberId) 
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    // Manage Admins functions
    const handleManageAdmins = () => {
        setShowManageAdmins(true);
        // Initialize with current admins
        const currentAdminIds = currentChat?.admins?.map(admin => admin._id) || [];
        setSelectedAdmins(currentAdminIds);
    };

    const handleSaveAdmins = async () => {
        if (!currentChat) return;
        
        setIsLoading(true);
        try {
            // Get current admin IDs
            const currentAdminIds = currentChat.admins?.map(admin => admin._id) || [];
            
            // Find members to add as admins
            const membersToAdd = selectedAdmins.filter(adminId => 
                !currentAdminIds.includes(adminId)
            );
            
            // Find members to remove from admins
            const membersToRemove = currentAdminIds.filter(adminId => 
                !selectedAdmins.includes(adminId)
            );

            // Add new admins
            if (membersToAdd.length > 0) {
                await updateGroupAdmins(currentChat._id, membersToAdd, 'add');
            }

            // Remove admins
            if (membersToRemove.length > 0) {
                await updateGroupAdmins(currentChat._id, membersToRemove, 'remove');
            }

            setSelectedAdmins([]);
            setShowManageAdmins(false);
        } catch (error) {
            console.error('Failed to update admins:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAdminSelection = (adminId: string) => {
        setSelectedAdmins(prev => 
            prev.includes(adminId) 
                ? prev.filter(id => id !== adminId)
                : [...prev, adminId]
        );
    };

    const navigationItems = [
        {
            id: 'general',
            title: 'General',
            icon: IoSettingsOutline
        },
        {
            id: 'members',
            title: 'Members',
            icon: IoPeopleOutline
        },
        {
            id: 'administrators',
            title: 'Administrators',
            icon: IoShieldOutline
        }
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className='group-management-content'>
                        <div className='group-management-section'>
                            <div className='group-management-section-header'>
                                <h3 className='group-management-section-title'>Group Information</h3>
                            </div>
                            <div className='group-management-form'>
                                <FormInput
                                    label='Group Name'
                                    value={editGroupName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditGroupName(e.target.value)}
                                    placeholder='Enter group name'
                                    required
                                    disabled={isLoading}
                                />
                                
                                <FormInput
                                    label='Group Description'
                                    value={editGroupDescription}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditGroupDescription(e.target.value)}
                                    placeholder='Enter group description (optional)'
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className='group-management-section group-management-danger-zone'>
                            <div className='group-management-section-header'>
                                <h3 className='group-management-section-title'>Danger Zone</h3>
                            </div>
                            <Button
                                type='button'
                                className='red-on-light sm'
                                title='Leave Group'
                                onClick={handleLeaveGroup}
                                disabled={isLoading}
                            >
                                <IoExitOutline />
                                Leave Group
                            </Button>
                        </div>
                    </div>
                );

            case 'members':
                return (
                    <div className='group-management-content'>
                        <div className='group-management-section'>
                            {!showAddMembers && (
                                <div className='group-management-section-header'>
                                    <h3 className='group-management-section-title'>Group Members</h3>
                                    {(isAdmin || isOwner) && (
                                        <Button
                                            type='button'
                                            className='black-on-light sm'
                                            title='Add Members'
                                            onClick={handleAddMembers}
                                        >
                                            <IoPersonAddOutline />
                                            Add Members
                                        </Button>
                                    )}
                                </div>
                            )}
                            
                            {!showAddMembers ? (
                                <div className='group-management-members-list'>
                                    {currentChat.participants.map((member) => {
                                        const isMemberAdmin = currentChat.admins?.some(admin => admin._id === member._id) || false;
                                        const isMemberOwner = currentChat.createdBy?._id === member._id;
                                        
                                        return (
                                            <div key={member._id} className='group-management-member'>
                                                <div className='group-management-member-avatar'>
                                                    {getInitials(member.firstName, member.lastName)}
                                                </div>
                                                <div className='group-management-member-info'>
                                                    <span className='group-management-member-name'>
                                                        {member.firstName} {member.lastName}
                                                    </span>
                                                    <span className='group-management-member-role'>
                                                        {isMemberOwner ? 'Owner' : isMemberAdmin ? 'Admin' : 'Member'}
                                                    </span>
                                                </div>
                                                {isMemberOwner && (
                                                    <div className='group-management-member-badge owner'>
                                                        <IoStarOutline />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className='group-management-add-members'>
                                    <div className='group-management-add-members-header'>
                                        <div 
                                            className='group-management-back-button'
                                            onClick={() => {
                                                setShowAddMembers(false);
                                                setSelectedMembers([]);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <IoArrowBackOutline />
                                            <h4>Add Members</h4>
                                        </div>
                                    </div>

                                    <div className='group-management-add-members-search'>
                                        <div className='group-management-search-container'>
                                            <IoSearchOutline className='group-management-search-icon' />
                                            <input
                                                type='text'
                                                placeholder='Search team members...'
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className='group-management-search-input'
                                            />
                                        </div>
                                    </div>

                                    <div className='group-management-available-members'>
                                        {(() => {
                                            const availableMembers = teamMembers.filter(member => 
                                                !currentChat?.participants.some(participant => participant._id === member._id) &&
                                                member._id !== user?._id
                                            );

                                            const filteredMembers = availableMembers.filter(member => {
                                                const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
                                                return fullName.includes(searchQuery.toLowerCase());
                                            });

                                            return (
                                                <div className='group-management-members-list'>
                                                    {filteredMembers.map((member) => {
                                                        const isSelected = selectedMembers.includes(member._id);
                                                        
                                                        return (
                                                            <div 
                                                                key={member._id} 
                                                                className={`group-management-member ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => toggleMemberSelection(member._id)}
                                                            >
                                                                <div className='group-management-member-avatar'>
                                                                    {getInitials(member.firstName, member.lastName)}
                                                                </div>
                                                                <div className='group-management-member-info'>
                                                                    <span className='group-management-member-name'>
                                                                        {member.firstName} {member.lastName}
                                                                    </span>
                                                                    <span className='group-management-member-role'>
                                                                        {member.email}
                                                                    </span>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className='group-management-member-check'>
                                                                        <IoCheckmarkCircleOutline />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {selectedMembers.length > 0 && (
                                        <div className='group-management-selected-summary'>
                                            <p>
                                                <IoCheckmarkCircleOutline className='check-icon' />
                                                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                                            </p>
                                        </div>
                                    )}

                                    <div className='group-management-add-members-actions'>
                                        <Button
                                            type='button'
                                            className='black-on-light sm'
                                            title='Add Selected Members'
                                            onClick={handleAddSelectedMembers}
                                            disabled={selectedMembers.length === 0 || isLoading}
                                        >
                                            {isLoading ? 'Adding...' : `Add ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'administrators':
                return (
                    <div className='group-management-content'>
                        <div className='group-management-section'>
                            {!showManageAdmins && (
                                <div className='group-management-section-header'>
                                    <h3 className='group-management-section-title'>Group Administrators</h3>
                                    {isOwner && (
                                        <Button
                                            type='button'
                                            className='black-on-light sm'
                                            title='Manage Admins'
                                            onClick={handleManageAdmins}
                                        >
                                            <IoShieldOutline />
                                            Manage Admins
                                        </Button>
                                    )}
                                </div>
                            )}
                            
                            {!showManageAdmins ? (
                                <div className='group-management-admins-list'>
                                    {/* Owner */}
                                    <div className='group-management-admin owner'>
                                        <div className='group-management-admin-avatar'>
                                            {getInitials(
                                                currentChat.createdBy?.firstName || '',
                                                currentChat.createdBy?.lastName || ''
                                            )}
                                        </div>
                                        <div className='group-management-admin-info'>
                                            <span className='group-management-admin-name'>
                                                {currentChat.createdBy?.firstName} {currentChat.createdBy?.lastName}
                                            </span>
                                            <span className='group-management-admin-role'>Owner</span>
                                        </div>
                                        <div className='group-management-admin-badge owner'>
                                            <IoStarOutline />
                                        </div>
                                    </div>

                                    {/* Admins */}
                                    {currentChat.admins?.filter(admin => admin._id !== currentChat.createdBy?._id).map((admin) => (
                                        <div key={admin._id} className='group-management-admin'>
                                            <div className='group-management-admin-avatar'>
                                                {getInitials(admin.firstName, admin.lastName)}
                                            </div>
                                            <div className='group-management-admin-info'>
                                                <span className='group-management-admin-name'>
                                                    {admin.firstName} {admin.lastName}
                                                </span>
                                                <span className='group-management-admin-role'>Administrator</span>
                                            </div>
                                            <div className='group-management-admin-badge'>
                                                <IoShieldOutline />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='group-management-manage-admins'>
                                    <div className='group-management-manage-admins-header'>
                                        <div 
                                            className='group-management-back-button'
                                            onClick={() => {
                                                setShowManageAdmins(false);
                                                setSelectedAdmins([]);
                                            }}
                                        >
                                            <IoArrowBackOutline />
                                            <h4>Manage Administrators</h4>
                                        </div>
                                    </div>

                                    <div className='group-management-available-admins'>
                                        <div className='group-management-admins-list'>
                                            {/* Owner - cannot be changed */}
                                            <div className='group-management-admin owner disabled'>
                                                <div className='group-management-admin-avatar'>
                                                    {getInitials(
                                                        currentChat.createdBy?.firstName || '',
                                                        currentChat.createdBy?.lastName || ''
                                                    )}
                                                </div>
                                                <div className='group-management-admin-info'>
                                                    <span className='group-management-admin-name'>
                                                        {currentChat.createdBy?.firstName} {currentChat.createdBy?.lastName}
                                                    </span>
                                                    <span className='group-management-admin-role'>Owner (Cannot be changed)</span>
                                                </div>
                                                <div className='group-management-admin-badge owner'>
                                                    <IoStarOutline />
                                                </div>
                                                <IoLockClosedOutline className='lock-icon' />
                                            </div>

                                            {/* Available members for admin */}
                                            {currentChat.participants
                                                .filter(participant => participant._id !== currentChat.createdBy?._id)
                                                .map((member) => {
                                                    const isSelected = selectedAdmins.includes(member._id);
                                                    const isCurrentAdmin = currentChat.admins?.some(admin => admin._id === member._id) || false;
                                                    
                                                    return (
                                                        <div 
                                                            key={member._id} 
                                                            className={`group-management-admin ${isSelected ? 'selected' : ''} ${isCurrentAdmin ? 'current-admin' : ''}`}
                                                            onClick={() => toggleAdminSelection(member._id)}
                                                        >
                                                            <div className='group-management-admin-avatar'>
                                                                {getInitials(member.firstName, member.lastName)}
                                                            </div>
                                                            <div className='group-management-admin-info'>
                                                                <span className='group-management-admin-name'>
                                                                    {member.firstName} {member.lastName}
                                                                </span>
                                                                <span className='group-management-admin-role'>
                                                                    {isCurrentAdmin ? 'Current Admin' : 'Member'}
                                                                </span>
                                                            </div>
                                                            {isSelected && (
                                                                <div className='group-management-admin-check'>
                                                                    <IoCheckmarkCircleOutline />
                                                                </div>
                                                            )}
                                                            {isCurrentAdmin && (
                                                                <IoStarOutline className='star-icon' />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {selectedAdmins.length > 0 && (
                                        <div className='group-management-selected-summary'>
                                            <p>
                                                <IoCheckmarkCircleOutline className='check-icon' />
                                                {selectedAdmins.length} admin{selectedAdmins.length !== 1 ? 's' : ''} selected
                                            </p>
                                        </div>
                                    )}

                                    <div className='group-management-manage-admins-actions'>
                                        <Button
                                            type='button'
                                            className='black-on-light sm'
                                            title='Save Changes'
                                            onClick={handleSaveAdmins}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Draggable className='group-management-container primary-surface'>
            <div className='group-management-left-container'>
                <div className='group-management-left-top-container'>
                    <WindowIcons onClose={() => setShowGroupManagement(false)} />

                    <div className='group-management-nav-container'>
                        <div className='group-management-nav'>
                            <h3 className='group-management-nav-title'>Group Settings</h3>
                            <div className='group-management-nav-items'>
                                {navigationItems.map((item) => (
                                    <div 
                                        key={item.id}
                                        className={`group-management-nav-item ${activeSection === item.id ? 'active' : ''}`}
                                        onClick={() => setActiveSection(item.id as any)}
                                    >
                                        <i className='group-management-nav-item-icon'>
                                            <item.icon size={16} />
                                        </i>
                                        <span className='group-management-nav-item-title'>{item.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='group-management-left-bottom-container'>
                    <div className='group-management-group-info'>
                        <div className='group-management-group-avatar'>
                            <IoPeopleOutline />
                        </div>
                        <div className='group-management-group-details'>
                            <h4 className='group-management-group-name'>{currentChat.groupName}</h4>
                            <p className='group-management-group-members-count'>
                                {currentChat.participants.length} members
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className='group-management-right-container'>
                {renderContent()}
            </div>
        </Draggable>
    );
};

export default GroupManagementModal;    