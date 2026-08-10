import useMessagesPage from '../../hooks/chat/use-messages-page';
import ChatArea from '../ChatArea';
import ChatSidebar from '../ChatSidebar';
import CreateGroupModal from '../CreateGroupModal';
import GroupManagementModal from '../GroupManagementModal';
import ChatDetailsPanel from '../ChatDetailsPanel';
import { cn } from '@heroui/react';
import { useParams } from 'react-router-dom';
import useTip from '@/shared/tips/use-tip';

/**
 * The three-pane responsive swap used to live in `MessagesPage.css` as child
 * selectors on the other three components' classes (`.messages-page > .chat-area`
 * and friends). Those classes stay on the elements, but each pane now carries its
 * own share of the layout as utilities, and the two state flags below are read
 * back through ancestor-flag variants (`[.messages-page--chat-open_&]`) instead of
 * through descendant rules in a stylesheet — see ChatSidebar / ChatArea /
 * ChatDetailsPanel for the receiving end.
 */
const MessagesPage = () => {
    const { chatId } = useParams<'chatId'>();
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
        toggleDetails,
        closeDetails,
        sendMessage,
        isSendingMessage,
        isSendingFile,
        editMessage,
        deleteMessage,
        setReaction,
        removeReaction,
        addUsersToGroup,
        leaveGroup
    } = useMessagesPage(chatId);

    useTip('messages-details-panel', {
        enabled: Boolean(currentChat)
    });

    return (
        <div className={cn(
            'relative flex h-full border-t border-border messages-page',
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
                onSetReaction={setReaction}
                onRemoveReaction={removeReaction}
                onInfoClick={toggleDetails}
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
        </div>
    );
};

export default MessagesPage;
