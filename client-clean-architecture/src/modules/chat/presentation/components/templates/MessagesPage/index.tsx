import { useParams } from 'react-router-dom';
import { useMessagesPage } from '@/modules/chat/presentation/hooks';
import { ChatSidebar, ChatArea, CreateGroupModal, GroupManagementModal } from '../../organisms';
import { ChatDetailsPanel } from '../../molecules';
import Container from '@/shared/presentation/components/Container';
import './MessagesPage.css';

const MessagesPage = () => {
    const { chatId } = useParams<{ chatId?: string }>();

    const {
        currentChat,
        chats,
        messages,
        currentTypingUsers,
        currentUserId,
        otherParticipantPresence,
        teamMembersAsUsers,
        isChatsLoading,
        isMessagesLoading,
        hasMoreMessages,
        showDetails,
        setShowDetails,
        handleSelectChat,
        handleStartChat,
        handleLoadMore,
        handleTyping,
        handleCreateGroup,
        handleSendFiles,
        handleUpdateGroupInfo,
        handleUpdateAdmins,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        addUsersToGroup,
        leaveGroup
    } = useMessagesPage(chatId);

    return (
        <Container className='d-flex h-max messages-page'>
            <ChatSidebar
                chats={chats}
                currentChatId={chatId}
                currentUserId={currentUserId}
                teamMembers={teamMembersAsUsers}
                isLoading={isChatsLoading}
                onSelectChat={handleSelectChat}
                onStartChatWithMember={handleStartChat}
            />

            <ChatArea
                chat={currentChat}
                messages={messages}
                typingUsers={currentTypingUsers}
                currentUserId={currentUserId}
                presence={otherParticipantPresence}
                isLoading={isMessagesLoading}
                hasMore={hasMoreMessages}
                onLoadMore={handleLoadMore}
                onTyping={handleTyping}
                onSendText={sendMessage}
                onSendFiles={handleSendFiles}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                onToggleReaction={toggleReaction}
                onInfoClick={() => setShowDetails(!showDetails)}
            />

            {showDetails && (
                <ChatDetailsPanel
                    chat={currentChat}
                    messages={messages}
                    currentUserId={currentUserId}
                    presence={otherParticipantPresence}
                />
            )}

            <CreateGroupModal
                teamMembers={teamMembersAsUsers}
                currentUserId={currentUserId}
                onCreateGroup={handleCreateGroup}
            />

            <GroupManagementModal
                chat={currentChat}
                teamMembers={teamMembersAsUsers}
                currentUserId={currentUserId}
                onUpdateInfo={handleUpdateGroupInfo}
                onAddMembers={addUsersToGroup}
                onUpdateAdmins={handleUpdateAdmins}
                onLeaveGroup={leaveGroup}
            />
        </Container>
    );
};

export default MessagesPage;
