/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { useChat } from '@/hooks/chat/useChat';
import { 
    IoCloseOutline, 
    IoCreateOutline
} from 'react-icons/io5';
import useAuthStore from '@/stores/authentication';

const EditGroupModal = () => {
    const { 
        currentChat, 
        editGroupName,
        editGroupDescription,
        setShowEditGroup, 
        setEditGroupName,
        setEditGroupDescription,
        updateGroupInfo
    } = useChatStore();
    const user = useAuthStore((store) => store.user);
    const [isLoading, setIsLoading] = React.useState(false);

    if (!currentChat || !currentChat.isGroup) return null;

    const isAdmin = currentChat.admins?.some(admin => admin._id === user?._id) || false;
    const isOwner = currentChat.createdBy?._id === user?._id;
    
    // Only show if user is admin or owner
    if (!isAdmin && !isOwner) return null;

    // Initialize form with current group data
    useEffect(() => {
        if (currentChat) {
            setEditGroupName(currentChat.groupName || '');
            setEditGroupDescription(currentChat.groupDescription || '');
        }
    }, [currentChat, setEditGroupName, setEditGroupDescription]);

    const handleSaveGroup = async () => {
        if (!editGroupName.trim()) return;
        
        setIsLoading(true);
        try {
            await updateGroupInfo(
                currentChat._id, 
                editGroupName.trim(), 
                editGroupDescription.trim()
            );
            setShowEditGroup(false);
        } catch (error) {
            console.error('Failed to update group:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setShowEditGroup(false);
    };

    return (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Edit Group</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={handleClose}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                
                <div className='chat-group-management-body'>
                    {/* Group Info Form */}
                    <div className='chat-edit-group-form'>
                        <div className='chat-edit-group-field'>
                            <label className='chat-edit-group-label'>
                                Group Name
                            </label>
                            <input
                                type='text'
                                className='chat-edit-group-input'
                                placeholder='Enter group name'
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                maxLength={50}
                            />
                            <span className='chat-edit-group-char-count'>
                                {editGroupName.length}/50
                            </span>
                        </div>

                        <div className='chat-edit-group-field'>
                            <label className='chat-edit-group-label'>
                                Group Description
                            </label>
                            <textarea
                                className='chat-edit-group-textarea'
                                placeholder='Enter group description (optional)'
                                value={editGroupDescription}
                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                maxLength={200}
                                rows={3}
                            />
                            <span className='chat-edit-group-char-count'>
                                {editGroupDescription.length}/200
                            </span>
                        </div>
                    </div>

                    {/* Group Info Preview */}
                    <div className='chat-edit-group-preview'>
                        <h5>Preview</h5>
                        <div className='chat-edit-group-preview-content'>
                            <div className='chat-edit-group-preview-avatar'>
                                <IoCreateOutline />
                            </div>
                            <div className='chat-edit-group-preview-details'>
                                <h4 className='chat-edit-group-preview-name'>
                                    {editGroupName || 'Group Name'}
                                </h4>
                                {editGroupDescription && (
                                    <p className='chat-edit-group-preview-description'>
                                        {editGroupDescription}
                                    </p>
                                )}
                                <p className='chat-edit-group-preview-members'>
                                    {currentChat.participants.length} members
                                </p>
                            </div>
                        </div>
                    </div>

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
                            onClick={handleSaveGroup}
                            disabled={!editGroupName.trim() || isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditGroupModal;
