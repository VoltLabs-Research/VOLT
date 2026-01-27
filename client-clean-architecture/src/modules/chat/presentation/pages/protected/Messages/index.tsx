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

import { useChatStore } from '@/modules/chat/presentation/stores';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import ChatSidebar from '@/modules/chat/presentation/components/molecules/ChatSidebar';
import CreateGroupModal from '@/modules/chat/presentation/components/molecules/CreateGroupModal';
import GroupManagementModal from '@/modules/chat/presentation/components/molecules/GroupManagementModal';
import ChatArea from '@/modules/chat/presentation/components/organisms/ChatArea';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/chat/presentation/pages/protected/Messages/Messages.css';

const MessagesPage = () => {
    const {
        showCreateGroup
    } = useChatStore();

    usePageTitle('Messages');

    return (
        <Container className='chat-main-container d-flex column h-max w-max flex-1 p-relative overflow-hidden'>
            <Container className='d-flex h-max w-max flex-1'>
                <ChatSidebar />
                <ChatArea />
            </Container>

            <CreateGroupModal />

            <GroupManagementModal />

        </Container>
    )
};

export default MessagesPage;
