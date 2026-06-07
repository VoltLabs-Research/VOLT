import useMessagesPage from '../../hooks/chat/use-messages-page';
import ChatArea from '../ChatArea';
import ChatSidebar from '../ChatSidebar';
import CreateGroupModal from '../CreateGroupModal';
import GroupManagementModal from '../GroupManagementModal';
import ChatDetailsPanel from '../ChatDetailsPanel';
import { Box } from '@voltstack/bravais';
import { cn } from '@/shared/utils/cn';
import { useParams } from 'react-router-dom';
import useTip from '@/shared/tips/use-tip';
import './MessagesPage.css';

type MessagesPageRouteParam = 'chatId';

const MessagesPage = () => {
    const { chatId } = useParams<MessagesPageRouteParam>();

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
        chatsError,
        showDetails,
        handleSelectChat,
        handleStartChat,
        handleBackToList,
        handleLoadMore,
        handleTyping,
        handleCreateGroup,
        handleSendFiles,
        handleUpdateGroupInfo,
        handleUpdateAdmins,
        handleInfoClick,
        closeDetails,
        sendMessage,
        isSendingMessage,
        isSendingFile,
        editMessage,
        deleteMessage,
        toggleReaction,
        addUsersToGroup,
        leaveGroup
    } = useMessagesPage(chatId);

    useTip('messages-details-panel', {
        enabled: Boolean(currentChat)
    });

    return (
        <Box display='flex' height='max' className={cn(
                'messages-page',
                chatId && 'messages-page--chat-open',
                showDetails && currentChat && 'messages-page--details-open'
            )}>
            <ChatSidebar
                chats={chats}
                currentChatId={chatId}
                currentUserId={currentUserId}
                teamMembers={teamMembersAsUsers}
                isLoading={isChatsLoading}
                error={chatsError}
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
                isSending={isSendingMessage || isSendingFile}
                hasMore={hasMoreMessages}
                onLoadMore={handleLoadMore}
                onBackClick={handleBackToList}
                onTyping={handleTyping}
                onSendText={sendMessage}
                onSendFiles={handleSendFiles}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                onToggleReaction={toggleReaction}
                onInfoClick={handleInfoClick}
                isDetailsOpen={showDetails}
            />

            {showDetails && (
                <ChatDetailsPanel
                    chat={currentChat}
                    messages={messages}
                    currentUserId={currentUserId}
                    presence={otherParticipantPresence}
                    onClose={closeDetails}
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
        </Box>
    );
};

export default MessagesPage;
