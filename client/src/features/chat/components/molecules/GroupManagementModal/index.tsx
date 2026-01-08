/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { useState, useEffect } from 'react';
import { useChatStore } from '@/features/chat/stores';
import { useChat } from '@/features/chat/hooks/use-chat';
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
    IoCheckmarkCircleOutline
} from 'react-icons/io5';
import { useAuthStore } from '@/features/auth/stores';
import Modal from '@/components/molecules/common/Modal';
import Button from '@/components/primitives/Button';
import FormInput from '@/components/atoms/form/FormInput';
import { useFormValidation } from '@/hooks/common/use-form-validation';
import '@/features/chat/components/molecules/GroupManagementModal/GroupManagementModal.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import useConfirm from '@/hooks/ui/use-confirm';

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
    const { confirm } = useConfirm();

    // Add Members states
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    // Manage Admins states
    const [showManageAdmins, setShowManageAdmins] = useState(false);
    const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

    const { errors, validateField, checkField, clearError } = useFormValidation({
        editGroupName: { required: true, minLength: 3, maxLength: 50, message: 'Group name must be between 3 and 50 characters' },
        editGroupDescription: { maxLength: 250, message: 'Description cannot exceed 250 characters' }
    });

    const isGroupChat = currentChat && currentChat.isGroup;
    const isAdmin = isGroupChat && (currentChat.admins?.some(admin => admin._id === user?._id) || false);
    const isOwner = isGroupChat && currentChat.createdBy?._id === user?._id;

    // Initialize form with current group data
    useEffect(() => {
        if (currentChat) {
            setEditGroupName(currentChat.groupName || '');
            setEditGroupDescription(currentChat.groupDescription || '');
        }
    }, [currentChat, setEditGroupName, setEditGroupDescription]);

    // Auto-save when user stops typing
    useEffect(() => {
        if (!isGroupChat) return;

        const timeoutId = setTimeout(() => {
            // Validate before saving
            const nameError = validateField('editGroupName', editGroupName);
            const descError = validateField('editGroupDescription', editGroupDescription);

            if (!nameError && !descError && editGroupName.trim() && editGroupName !== currentChat?.groupName) {
                updateGroupInfo(
                    currentChat._id,
                    editGroupName.trim(),
                    editGroupDescription.trim()
                );
            }
        }, 1000); // 1 second delay

        return () => clearTimeout(timeoutId);
    }, [editGroupName, editGroupDescription, currentChat, updateGroupInfo, isGroupChat]);

    // Early return AFTER all hooks
    if (!isGroupChat) return null;

    // Add Members functions
    const handleLeaveGroup = async () => {
        const isConfirmed = await confirm('Are you sure you want to leave this group?');
        if (!isConfirmed) return;

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

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditGroupName(e.target.value);
        checkField('editGroupName', e.target.value);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditGroupDescription(e.target.value);
        checkField('editGroupDescription', e.target.value);
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className='group-management-content h-max'>
                        <div className='group-management-section gap-1'>
                            <div className='d-flex items-center content-between gap-1 sm:column sm:items-start group-management-section-header'>
                                <Title className='font-size-3 group-management-section-title color-primary'>Group Information</Title>
                            </div>
                            <div className='d-flex column gap-1 group-management-form'>
                                <div>
                                    <FormInput
                                        label='Group Name'
                                        value={editGroupName}
                                        onChange={handleNameChange}
                                        placeholder='Enter group name'
                                        required
                                        disabled={isLoading}
                                        error={errors.editGroupName}
                                    />
                                </div>

                                <div>
                                    <FormInput
                                        label='Group Description'
                                        value={editGroupDescription}
                                        onChange={handleDescriptionChange}
                                        placeholder='Enter group description(optional)'
                                        disabled={isLoading}
                                        error={errors.editGroupDescription}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='group-management-section group-management-danger-zone mt-1 p-relative overflow-hidden p-1-5 gap-1'>
                            <div className='d-flex items-center content-between gap-1 group-management-section-header'>
                                <Title className='font-size-3 group-management-section-title color-primary'>Danger Zone</Title>
                            </div>
                            <Button
                                variant='soft'
                                intent='danger'
                                size='sm'
                                leftIcon={<IoExitOutline />}
                                onClick={handleLeaveGroup}
                                disabled={isLoading}
                            >
                                Leave Group
                            </Button>
                        </div>
                    </div>
                );

            case 'members':
                return (
                    <div className='group-management-content h-max'>
                        <div className='group-management-section gap-1'>
                            {!showAddMembers && (
                                <div className='d-flex items-center content-between gap-1 sm:column sm:items-start group-management-section-header'>
                                    <Title className='font-size-3 group-management-section-title color-primary'>Group Members</Title>
                                    {(isAdmin || isOwner) && (
                                        <Button
                                            variant='solid'
                                            intent='brand'
                                            size='sm'
                                            leftIcon={<IoPersonAddOutline />}
                                            onClick={handleAddMembers}
                                        >
                                            Add Members
                                        </Button>
                                    )}
                                </div>
                            )}

                            {!showAddMembers ? (
                                <div className='d-flex column gap-05 group-management-members-list'>
                                    {currentChat.participants.map((member) => {
                                        const isMemberAdmin = currentChat.admins?.some(admin => admin._id === member._id) || false;
                                        const isMemberOwner = currentChat.createdBy?._id === member._id;

                                        return (
                                            <div key={member._id} className='d-flex items-center gap-0875 group-management-member p-relative overflow-hidden cursor-pointer'>
                                                <div className='d-flex flex-center group-management-member-avatar overflow-hidden'>
                                                    {member.avatar
                                                        ? <img src={member.avatar} alt="" className='w-max h-max object-cover' />
                                                        : '?'}
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
                                                    <div className='d-flex flex-center group-management-member-badge owner color-secondary'>
                                                        <IoStarOutline />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className='d-flex column gap-125 group-management-add-members'>
                                    <div className='d-flex items-center group-management-add-members-header p-relative overflow-hidden'>
                                        <div
                                            className='d-flex items-center gap-075 group-management-back-button p-relative cursor-pointer p-05 gap-05 color-primary'
                                            onClick={() => {
                                                setShowAddMembers(false);
                                                setSelectedMembers([]);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <IoArrowBackOutline />
                                            <Title className='font-size-2-5'>Add Members</Title>
                                        </div>
                                    </div>

                                    <div className='group-management-add-members-search p-relative'>
                                        <div className='d-flex items-center group-management-search-container p-relative'>
                                            <IoSearchOutline className='group-management-search-icon p-absolute color-muted' />
                                            <input
                                                type='text'
                                                placeholder='Search team members...'
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className='group-management-search-input w-max font-size-2 font-weight-5 color-primary'
                                            />
                                        </div>
                                    </div>

                                    <div className='group-management-available-members p-relative y-auto'>
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
                                                <div className='d-flex column gap-05 group-management-members-list'>
                                                    {filteredMembers.map((member) => {
                                                        const isSelected = selectedMembers.includes(member._id);

                                                        return (
                                                            <div
                                                                key={member._id}
                                                                className={`d-flex items-center gap-0875 group-management-member ${isSelected ? 'selected' : ''} p-relative overflow-hidden cursor-pointer`}
                                                                onClick={() => toggleMemberSelection(member._id)}
                                                            >
                                                                <div className='d-flex flex-center group-management-member-avatar overflow-hidden'>
                                                                    {member.avatar
                                                                        ? <img src={member.avatar} alt="" className='w-max h-max object-cover' />
                                                                        : '?'}
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
                                                                    <div className='d-flex flex-center group-management-member-check font-size-2'>
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
                                        <div className='group-management-selected-summary text-center gap-1 font-weight-5'>
                                            <IoCheckmarkCircleOutline className='d-flex flex-center gap-05 check-icon' />
                                            <Paragraph>
                                                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                                            </Paragraph>
                                        </div>
                                    )}

                                    <div className='d-flex content-end group-management-add-members-actions'>
                                        <Button
                                            variant='solid'
                                            intent='brand'
                                            size='sm'
                                            onClick={handleAddSelectedMembers}
                                            disabled={selectedMembers.length === 0 || isLoading}
                                            isLoading={isLoading}
                                        >
                                            Add {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'administrators':
                return (
                    <div className='group-management-content h-max'>
                        <div className='group-management-section gap-1'>
                            {!showManageAdmins && (
                                <div className='d-flex items-center content-between gap-1 sm:column sm:items-start group-management-section-header'>
                                    <Title className='font-size-3 group-management-section-title color-primary'>Group Administrators</Title>
                                    {isOwner && (
                                        <Button
                                            variant='solid'
                                            intent='brand'
                                            size='sm'
                                            leftIcon={<IoShieldOutline />}
                                            onClick={handleManageAdmins}
                                        >
                                            Manage Admins
                                        </Button>
                                    )}
                                </div>
                            )}

                            {!showManageAdmins ? (
                                <div className='d-flex column gap-05 group-management-admins-list'>
                                    {/* Owner */}
                                    <div className='d-flex items-center gap-0875 group-management-admin owner p-relative overflow-hidden cursor-pointer'>
                                        <div className='d-flex flex-center group-management-admin-avatar overflow-hidden'>
                                            {currentChat.createdBy?.avatar
                                                ? <img src={currentChat.createdBy.avatar} alt="" className='w-max h-max object-cover' />
                                                : '?'}
                                        </div>
                                        <div className='group-management-admin-info'>
                                            <span className='group-management-admin-name'>
                                                {currentChat.createdBy?.firstName} {currentChat.createdBy?.lastName}
                                            </span>
                                            <span className='group-management-admin-role'>Owner</span>
                                        </div>
                                        <div className='d-flex flex-center group-management-admin-badge owner'>
                                            <IoStarOutline />
                                        </div>
                                    </div>

                                    {/* Admins */}
                                    {currentChat.admins?.filter(admin => admin._id !== currentChat.createdBy?._id).map((admin) => (
                                        <div key={admin._id} className='d-flex items-center gap-0875 group-management-admin p-relative overflow-hidden cursor-pointer'>
                                            <div className='d-flex flex-center group-management-admin-avatar overflow-hidden'>
                                                {admin.avatar
                                                    ? <img src={admin.avatar} alt="" className='w-max h-max object-cover' />
                                                    : '?'}
                                            </div>
                                            <div className='group-management-admin-info'>
                                                <span className='group-management-admin-name'>
                                                    {admin.firstName} {admin.lastName}
                                                </span>
                                                <span className='group-management-admin-role'>Administrator</span>
                                            </div>
                                            <div className='d-flex flex-center group-management-admin-badge'>
                                                <IoShieldOutline />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='d-flex column gap-025 group-management-manage-admins'>
                                    <div className='d-flex items-center group-management-manage-admins-header p-relative overflow-hidden'>
                                        <div
                                            className='d-flex items-center gap-075 group-management-back-button p-relative cursor-pointer p-05 gap-05 color-primary'
                                            onClick={() => {
                                                setShowManageAdmins(false);
                                                setSelectedAdmins([]);
                                            }}
                                        >
                                            <IoArrowBackOutline />
                                            <Title className='font-size-2-5'>Manage Administrators</Title>
                                        </div>
                                    </div>

                                    <div className='group-management-available-admins p-relative y-auto'>
                                        <div className='group-management-admins-list'>
                                            {/* Owner - cannot be changed */}
                                            <div className='d-flex items-center gap-0875 group-management-admin owner disabled p-relative overflow-hidden cursor-pointer'>
                                                <div className='d-flex flex-center group-management-admin-avatar overflow-hidden'>
                                                    {currentChat.createdBy?.avatar
                                                        ? <img src={currentChat.createdBy.avatar} alt="" className='w-max h-max object-cover' />
                                                        : '?'}
                                                </div>
                                                <div className='group-management-admin-info'>
                                                    <span className='group-management-admin-name'>
                                                        {currentChat.createdBy?.firstName} {currentChat.createdBy?.lastName}
                                                    </span>
                                                    <span className='group-management-admin-role'>Owner(Cannot be changed)</span>
                                                </div>
                                                <div className='d-flex flex-center group-management-admin-badge owner'>
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
                                                            className={`d-flex items-center gap-0875 group-management-admin ${isSelected ? 'selected' : ''} ${isCurrentAdmin ? 'current-admin' : ''} p-relative overflow-hidden cursor-pointer`}
                                                            onClick={() => toggleAdminSelection(member._id)}
                                                        >
                                                            <div className='d-flex flex-center group-management-admin-avatar overflow-hidden'>
                                                                {member.avatar
                                                                    ? <img src={member.avatar} alt="" className='w-max h-max object-cover' />
                                                                    : '?'}
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
                                                                <div className='group-management-admin-check font-size-2'>
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
                                        <div className='group-management-selected-summary text-center gap-1 font-weight-5'>
                                            <IoCheckmarkCircleOutline className='d-flex flex-center gap-05 check-icon' />
                                            <Paragraph>
                                                {selectedAdmins.length} admin{selectedAdmins.length !== 1 ? 's' : ''} selected
                                            </Paragraph>
                                        </div>
                                    )}

                                    <div className='d-flex content-end group-management-manage-admins-actions'>
                                        <Button
                                            variant='solid'
                                            intent='brand'
                                            size='sm'
                                            onClick={handleSaveAdmins}
                                            disabled={isLoading}
                                            isLoading={isLoading}
                                        >
                                            Save Changes
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
        <Modal
            id='group-management-modal'
            title='Group Settings'
            width='1050px'
            className='group-management-modal'
        >
            <div className='d-flex group-management-container-inner w-max overflow-hidden'>
                <div className='d-flex column content-between group-management-left-container p-relative'>
                    <div className='d-flex column gap-2 group-management-left-top-container'>
                        <div className='d-flex column gap-05 group-management-nav-container'>
                            <div className='d-flex column gap-05 group-management-nav'>
                                <Title className='font-size-3 group-management-nav-title font-weight-5 color-primary'>Settings</Title>
                                <div className='d-flex column gap-02 group-management-nav-items'>
                                    {navigationItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`d-flex items-center gap-075 group-management-nav-item ${activeSection === item.id ? 'active' : ''} p-relative overflow-hidden cursor-pointer color-secondary`}
                                            onClick={() => setActiveSection(item.id as any)}
                                        >
                                            <i className='d-flex flex-center group-management-nav-item-icon'>
                                                <item.icon size={16} />
                                            </i>
                                            <span className='group-management-nav-item-title font-weight-4'>{item.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='group-management-left-bottom-container'>
                        <div className='d-flex items-center gap-075 group-management-group-info p-relative overflow-hidden'>
                            <div className='d-flex flex-center group-management-group-avatar p-relative font-size-4 color-secondary'>
                                <IoPeopleOutline />
                            </div>
                            <div className='group-management-group-details p-relative flex-1'>
                                <Title className='font-size-2-5 group-management-group-name overflow-hidden font-weight-6 color-primary'>{currentChat.groupName}</Title>
                                <Paragraph className='group-management-group-members-count color-secondary color-muted'>
                                    {currentChat.participants.length} members
                                </Paragraph>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='d-flex column gap-1 group-management-right-container h-max y-auto p-1-5'>
                    {renderContent()}
                </div>
            </div>
        </Modal>
    );
};

export default GroupManagementModal;
