import { useMemo } from 'react';
import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import type { Chat, Message, Participant } from '@/types/chat';
import useAuthStore from '@/stores/authentication';
import useAutoScroll from '@/hooks/ui/use-auto-scroll';
import useToggleId from '@/hooks/ui/use-toggle-id';
import MessageItem from '@/components/molecules/chat/MessageItem';
import TypingIndicator from '@/components/atoms/chat/TypingIndicator';
import ChatInput from '../ChatInput';
import WelcomeEmpty from '@/components/atoms/chat/WelcomeEmpty';
import DetailsPanel from '@/components/molecules/chat/DetailsPanel';
import ChatHeader from '@/components/molecules/chat/ChatHeader';
import MessageList from '@/components/molecules/chat/MessageLists';

const ChatArea = () => {
    const user = useAuthStore((state) => state.user);
    const { setShowGroupManagement } = useChatStore();

    const {
        handleTyping,
        sendFileMessage,
        handleSendMessage,
        messages,
        currentChat,
        editMessage,
        deleteMessage,
        toggleReaction,
        getUserPresence,
        typingUsers,
        isLoadingMessages,
        isConnected,
    } = useChat();

    const currentParticipant = useMemo(() => {
        return currentChat?.participants.find(p => p._id !== user?._id) || null;
    }, [currentChat?._id, user?._id]);

    const presence = useMemo(() => {
        if (!currentChat) return 'connecting' as const;
        if (currentChat.isGroup) return 'online' as const;
        if (!currentParticipant) return isConnected ? 'online' as const : 'connecting' as const;
        return (getUserPresence(currentParticipant._id) as any) || 'offline';
    }, [currentChat, currentParticipant, isConnected]);

    const endRef = useAutoScroll(messages);
    const { openId: optionsId, toggle: toggleOptions } = useToggleId<string>();
    const { openId: reactionsId, toggle: toggleReactions } = useToggleId<string>();

    return (
        <div className='chat-messages-container'>
            {currentChat ? (
                <div className='chat-box-container'>
                    <ChatHeader
                        chat={currentChat as Chat}
                        currentParticipant={currentParticipant as Participant | null}
                        presence={presence}
                    />

                    <MessageList
                        messages={messages}
                        isLoading={isLoadingMessages}
                        endRef={endRef}
                        selfId={user?._id}
                        renderItem={(m, isOwn) => (
                            <MessageItem
                                key={m._id}
                                msg={m}
                                isOwn={isOwn}
                                isGroupChat={currentChat?.isGroup}
                                currentChatId={currentChat?._id || ''}
                                onEdit={async (id, content) => { await editMessage(id, content); }}
                                onDelete={async (id) => { if (confirm('Are you sure you want to delete this message?')) await deleteMessage(id); }}
                                onToggleReaction={async (id, e) => { await toggleReaction(id, e); }}
                                isOptionsOpen={optionsId === m._id}
                                isReactionsOpen={reactionsId === m._id}
                                onToggleOptions={(id) => toggleOptions(id)}
                                onToggleReactions={(id) => toggleReactions(id)}
                            />
                        )}
                    />

                    <TypingIndicator users={typingUsers} />

                    <ChatInput
                        disabled={!currentChat}
                        onTyping={() => currentChat && handleTyping(currentChat._id)}
                        onSendText={async (text) => { await handleSendMessage(text); }}
                        onSendFiles={async (files) => { for (const f of files) await sendFileMessage(f); }}
                    />
                </div>
            ) : (
                <WelcomeEmpty isConnected={isConnected} />
            )}

            <DetailsPanel
                chat={currentChat as Chat | null}
                messages={messages as Message[]}
                isLoading={isLoadingMessages}
                presence={presence}
                currentParticipant={currentParticipant as Participant | null}
                onOpenGroupManagement={() => setShowGroupManagement(true)}
            />
        </div>
    );
};

export default ChatArea;