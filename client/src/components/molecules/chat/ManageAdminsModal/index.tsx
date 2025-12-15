import { useState } from 'react';
import { useChatStore } from '@/stores/chat';
import { useChat } from '@/hooks/chat/useChat';
import {
    IoCloseOutline,
    IoCheckmarkOutline,
    IoShieldOutline,
    IoShieldCheckmarkOutline
} from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';
import React from 'react';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './ManageAdminsModal.css';

const ManageAdminsModal = () => {
    const {
        currentChat,
        selectedAdmins,
        setShowManageAdmins,
        setSelectedAdmins,
        toggleAdminSelection,
        updateGroupAdmins
    } = useChatStore();
    const user = useAuthStore((store) => store.user);
    const [isLoading, setIsLoading] = useState(false);

    if (!currentChat || !currentChat.isGroup) return null;

    const isOwner = currentChat.createdBy?._id === user?._id;

    // Only show if user is the owner
    if (!isOwner) return null;

    // Get current admins(excluding the owner)
    const currentAdmins = currentChat.admins?.filter(admin => admin._id !== currentChat.createdBy?._id) || [];

    // Get all members who can be made admins(excluding the owner)
    const availableMembers = currentChat.participants.filter(participant =>
        participant._id !== currentChat.createdBy?._id
    );

    const handleSaveAdmins = async () => {
        setIsLoading(true);
        try {
            // Get current admin IDs
            const currentAdminIds = currentAdmins.map(admin => admin._id);

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

    const handleClose = () => {
        setSelectedAdmins([]);
        setShowManageAdmins(false);
    };

    // Initialize selected admins with current admins
    React.useEffect(() => {
        if (currentAdmins.length > 0 && selectedAdmins.length === 0) {
            setSelectedAdmins(currentAdmins.map(admin => admin._id));
        }
    }, [currentAdmins, selectedAdmins.length, setSelectedAdmins]);

    return (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <Title className='font-size-3'>Manage Admins</Title>
                    <button
                        className='chat-close-modal'
                        onClick={handleClose}
                    >
                        <IoCloseOutline />
                    </button>
                </div>

                <div className='chat-group-management-body'>
                    {/* Owner Info */}
                    <div className='chat-manage-admins-owner'>
                        <Title className='font-size-2-5'>Group Owner</Title>
                        <div className='d-flex items-center gap-075 chat-manage-admins-owner-member'>
                            <div className='d-flex flex-center chat-manage-admins-owner-avatar'>
                                {getInitials(
                                    currentChat.createdBy?.firstName || '',
                                    currentChat.createdBy?.lastName || ''
                                )}
                            </div>
                            <div className='chat-manage-admins-owner-info'>
                                <span className='chat-manage-admins-owner-name'>
                                    {currentChat.createdBy?.firstName} {currentChat.createdBy?.lastName}
                                </span>
                                <span className='chat-manage-admins-owner-role'>Owner</span>
                            </div>
                            <div className='d-flex flex-center chat-manage-admins-owner-badge'>
                                <IoShieldCheckmarkOutline />
                            </div>
                        </div>
                    </div>

                    {/* Available Members for Admin */}
                    <div className='chat-manage-admins-list'>
                        <Title className='font-size-2-5'>Make Admins</Title>
                        {availableMembers.length === 0 ? (
                            <div className='chat-manage-admins-empty'>
                                <Paragraph>No members available to make admins</Paragraph>
                            </div>
                        ) : (
                            <div className='d-flex column gap-05 chat-manage-admins-members'>
                                {availableMembers.map((member) => {
                                    const isSelected = selectedAdmins.includes(member._id);
                                    const isCurrentAdmin = currentAdmins.some(admin => admin._id === member._id);

                                    return (
                                        <div
                                            key={member._id}
                                            className={`d-flex items-center gap-075 chat-manage-admins-member ${isSelected ? 'selected' : ''} ${isCurrentAdmin ? 'current-admin' : ''}`}
                                            onClick={() => toggleAdminSelection(member._id)}
                                        >
                                            <div className='d-flex flex-center chat-manage-admins-member-avatar'>
                                                {getInitials(member.firstName, member.lastName)}
                                            </div>
                                            <div className='chat-manage-admins-member-info'>
                                                <span className='chat-manage-admins-member-name'>
                                                    {member.firstName} {member.lastName}
                                                </span>
                                                <span className='chat-manage-admins-member-role'>
                                                    {isCurrentAdmin ? 'Current Admin' : 'Member'}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <div className='d-flex flex-center chat-manage-admins-member-check'>
                                                    <IoCheckmarkOutline />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Admins Summary */}
                    {selectedAdmins.length > 0 && (
                        <div className='chat-manage-admins-selected'>
                            <Paragraph>{selectedAdmins.length} admin{selectedAdmins.length !== 1 ? 's' : ''} selected</Paragraph>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='chat-group-management-actions d-flex content-end gap-075 sm:column'>
                        <button
                            className='chat-group-management-cancel d-flex items-center gap-05'
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            className='chat-group-management-save d-flex items-center gap-05'
                            onClick={handleSaveAdmins}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageAdminsModal;
