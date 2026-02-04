import { useChatStore } from '@/features/chat/stores';
import { usePageTitle } from '@/hooks/core/use-page-title';
import ChatSidebar from '@/features/chat/components/molecules/ChatSidebar';
import CreateGroupModal from '@/features/chat/components/molecules/CreateGroupModal';
import GroupManagementModal from '@/features/chat/components/molecules/GroupManagementModal';
import ChatArea from '@/features/chat/components/organisms/ChatArea';
import Container from '@/components/primitives/Container';
import '@/features/chat/pages/protected/Messages/Messages.css';

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
