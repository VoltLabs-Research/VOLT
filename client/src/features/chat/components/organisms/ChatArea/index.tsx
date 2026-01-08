import { useMemo } from 'react';
import { useChat } from '@/features/chat/hooks/use-chat';
import { useChatStore } from '@/features/chat/stores';
import type { Chat, Message, Participant } from '@/types/chat';
import { useAuthStore } from '@/features/auth/stores';
import useAutoScroll from '@/hooks/ui/use-auto-scroll';
import useToggleId from '@/hooks/ui/use-toggle-id';
import MessageItem from '@/features/chat/components/molecules/MessageItem';
import TypingIndicator from '@/features/chat/components/atoms/TypingIndicator';
import ChatInput from '@/features/chat/components/organisms/ChatInput';
import WelcomeEmpty from '@/features/chat/components/atoms/WelcomeEmpty';
import DetailsPanel from '@/features/chat/components/molecules/DetailsPanel';
import ChatHeader from '@/features/chat/components/molecules/ChatHeader';
import MessageList from '@/features/chat/components/molecules/MessageLists';
import useConfirm from '@/hooks/ui/use-confirm';
import '@/features/chat/components/organisms/ChatArea/ChatArea.css';

const ChatArea = () => {
    const user = useAuthStore((state) => state.user);
    const { setShowGroupManagement } = useChatStore();
    const { confirm } = useConfirm();

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
        <div className='chat-messages-container d-flex flex-1 relative sm:column'>
            {currentChat ? (
                <div className='chat-box-container d-flex column flex-1 p-relative'>
                    <ChatHeader
                        chat={currentChat as Chat}
                        currentParticipant={currentParticipant as Participant | null}
                        presence={presence}
                    />

                    <MessageList
                        messages={messages}
                        isLoading={isLoadingMessages}
                        endRef={endRef as React.RefObject<HTMLDivElement>}
                        selfId={user?._id}
                        renderItem={(m, isOwn) => (
                            <MessageItem
                                key={m._id}
                                msg={m}
                                isOwn={isOwn}
                                isGroupChat={currentChat?.isGroup}
                                currentChatId={currentChat?._id || ''}
                                onEdit={async (id, content) => { await editMessage(id, content); }}
                                onDelete={async (id) => {
                                    const isConfirmed = await confirm('Are you sure you want to delete this message?');
                                    if (isConfirmed) await deleteMessage(id);
                                }}
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
