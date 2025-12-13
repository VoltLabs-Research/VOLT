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

    if(!currentChat || !currentChat.isGroup) return null;

    const isOwner = currentChat.createdBy?._id === user?._id;

    // Only show if user is the owner
    if(!isOwner) return null;

    // Get current admins(excluding the owner)
    const currentAdmins = currentChat.admins?.filter(admin => admin._id !== currentChat.createdBy?._id) || [];

    // Get all members who can be made admins(excluding the owner)
    const availableMembers = currentChat.participants.filter(participant =>
        participant._id !== currentChat.createdBy?._id
    );

    const handleSaveAdmins = async() => {
        setIsLoading(true);
        try{
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
            if(membersToAdd.length > 0){
                await updateGroupAdmins(currentChat._id, membersToAdd, 'add');
            }

            // Remove admins
            if(membersToRemove.length > 0){
                await updateGroupAdmins(currentChat._id, membersToRemove, 'remove');
            }

            setSelectedAdmins([]);
            setShowManageAdmins(false);
        }catch(error){
            console.error('Failed to update admins:', error);
        }finally{
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedAdmins([]);
        setShowManageAdmins(false);
    };

    // Initialize selected admins with current admins
    React.useEffect(() => {
        if(currentAdmins.length > 0 && selectedAdmins.length === 0){
            setSelectedAdmins(currentAdmins.map(admin => admin._id));
        }
    }, [currentAdmins, selectedAdmins.length, setSelectedAdmins]);

    return(
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Manage Admins</h3>
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
                        <h5>Group Owner</h5>
                        <div className='chat-manage-admins-owner-member'>
                            <div className='chat-manage-admins-owner-avatar'>
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
                            <div className='chat-manage-admins-owner-badge'>
                                <IoShieldCheckmarkOutline />
                            </div>
                        </div>
                    </div>

                    {/* Available Members for Admin */}
                    <div className='chat-manage-admins-list'>
                        <h5>Make Admins</h5>
                        {availableMembers.length === 0 ? (
                            <div className='chat-manage-admins-empty'>
                                <p>No members available to make admins</p>
                            </div>
                        ) : (
                            <div className='chat-manage-admins-members'>
                                {availableMembers.map((member) => {
                                    const isSelected = selectedAdmins.includes(member._id);
                                    const isCurrentAdmin = currentAdmins.some(admin => admin._id === member._id);

                                    return(
                                        <div
                                            key={member._id}
                                            className={`chat-manage-admins-member ${isSelected ? 'selected' : ''} ${isCurrentAdmin ? 'current-admin' : ''}`}
                                            onClick={() => toggleAdminSelection(member._id)}
                                        >
                                            <div className='chat-manage-admins-member-avatar'>
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
                                                <div className='chat-manage-admins-member-check'>
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
                            <p>{selectedAdmins.length} admin{selectedAdmins.length !== 1 ? 's' : ''} selected</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='chat-group-management-actions'>
                        <button
                            className='chat-group-management-cancel'
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            className='chat-group-management-save'
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
