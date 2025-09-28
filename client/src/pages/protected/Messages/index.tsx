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

import { useState } from 'react';
import { useChat } from '@/hooks/chat/useChat';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import ChatSidebar from '@/components/molecules/chat/ChatSidebar';
import ChatArea from '@/components/molecules/chat/ChatArea';
import GroupManagementModal from '@/components/molecules/chat/GroupManagementModal';
import EditGroupModal from '@/components/molecules/chat/EditGroupModal';
import ManageAdminsModal from '@/components/molecules/chat/ManageAdminsModal';
import AddMembersModal from '@/components/molecules/chat/AddMembersModal';
import CreateGroupModal from '@/components/molecules/chat/CreateGroupModal';
import './Messages.css';

const MessagesPage = () => {
    const {
        currentChat,
        addUsersToGroup,
        updateGroupAdmins,
    } = useChat();

    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showGroupManagement, setShowGroupManagement] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [showManageAdmins, setShowManageAdmins] = useState(false);
    const [showEditGroup, setShowEditorGroup] = useState(false);

    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0 || !currentChat) return;
        
        try {
            await addUsersToGroup(currentChat._id, selectedMembers);
            setShowAddMembers(false);
            setSelectedMembers([]);
        } catch (error) {
            console.error('Failed to add members:', error);
        }
    };

    const handleManageAdmins = () => {
        setShowManageAdmins(true);
        setSelectedAdmins([]);
    };

    const handleAddAdmins = async () => {
        if (!currentChat || selectedAdmins.length === 0) return;
        try {
            await updateGroupAdmins(currentChat._id, selectedAdmins, 'add');
            setShowManageAdmins(false);
            setSelectedAdmins([]);
        } catch (error) {
            console.error('Failed to add admins:', error);
        }
    };

    const handleRemoveAdmin = async (adminId: string) => {
        if (!currentChat) return;
        try {
            await updateGroupAdmins(currentChat._id, [adminId], 'remove');
        } catch (error) {
            console.error('Failed to remove admin:', error);
        }
    };

    const toggleAdminSelection = (userId: string) => {
        setSelectedAdmins(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };


    const toggleMemberSelection = (memberId: string) => {
        setSelectedMembers(prev => 
            prev.includes(memberId) 
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const openEditGroup = () => {
        if (currentChat) {
            //setEditGroupName(currentChat.groupName || '');
            //setEditGroupDescription(currentChat.groupDescription || '');
            //setShowEditGroup(true);
        }
    };

    const openAddMembers = () => {
        setSelectedMembers([]);
        setShowAddMembers(true);
    };

    return (
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            <ChatSidebar />
            <ChatArea />
            
            {/* Create Group Modal */}
            {showCreateGroup && (
                <CreateGroupModal
                    selectedMembers={selectedMembers}
                    setSelectedMembers={setSelectedMembers}
                    setShowCreateGroup={setShowCreateGroup}
                    toggleMemberSelection={toggleMemberSelection}
                />
            )}

            {/* Group Management Modal */}
            {showGroupManagement && currentChat?.isGroup && (
                <GroupManagementModal
                    handleManageAdmins={handleManageAdmins}
                    openAddMembers={openAddMembers}
                    openEditGroup={openEditGroup}
                    setShowGroupManagement={setShowGroupManagement}
                />
            )}

            {/* Edit Group Modal */}
            {showEditGroup && currentChat?.isGroup && (
                <EditGroupModal
                    setShowEditGroup={setShowEditorGroup}
                />
            )}

            {/* Manage Admins Modal */}
            {showManageAdmins && currentChat?.isGroup && (
                <ManageAdminsModal 
                    handleAddAdmins={handleAddAdmins}
                    handleRemoveAdmin={handleRemoveAdmin}
                    selectedAdmins={selectedAdmins}
                    toggle={setShowManageAdmins}
                    toggleAdminSelection={toggleAdminSelection}
                />
            )}

            {/* Add Members Modal */}
            {showAddMembers && currentChat?.isGroup && (
                <AddMembersModal
                    handleAddMembers={handleAddMembers}
                    selectedMembers={selectedMembers}
                    toggle={setShowAddMembers}
                    toggleMemberSelection={toggleMemberSelection}
                />
            )}

        </DashboardContainer>
    )
};

export default MessagesPage;