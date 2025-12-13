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

import { useChatStore } from '@/stores/chat';
import DashboardContainer from '@/components/atoms/dashboard/DashboardContainer';
import ChatSidebar from '@/components/molecules/chat/ChatSidebar';
import CreateGroupModal from '@/components/molecules/chat/CreateGroupModal';
import GroupManagementModal from '@/components/molecules/chat/GroupManagementModal';
import AddMembersModal from '@/components/molecules/chat/AddMembersModal';
import ManageAdminsModal from '@/components/molecules/chat/ManageAdminsModal';
import EditGroupModal from '@/components/molecules/chat/EditGroupModal';
import ChatArea from '@/components/organisms/chat/ChatArea';
import './Messages.css';

const MessagesPage = () => {
    const {
        showCreateGroup,
        showGroupManagement,
        showAddMembers,
        showManageAdmins,
        showEditGroup
    } = useChatStore();

    return(
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            <ChatSidebar />
            <ChatArea />

            {showCreateGroup && (
                <CreateGroupModal />
            )}

            {showGroupManagement && (
                <GroupManagementModal />
            )}

            {showAddMembers && (
                <AddMembersModal />
            )}

            {showManageAdmins && (
                <ManageAdminsModal />
            )}

            {showEditGroup && (
                <EditGroupModal />
            )}

        </DashboardContainer>
    )
};

export default MessagesPage;
