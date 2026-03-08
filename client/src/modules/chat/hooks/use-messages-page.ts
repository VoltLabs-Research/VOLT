import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useTeamMemberData from '@/modules/team/hooks/team-member/use-team-member-data';
import { useSelectedTeam, useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useChatPresenceStore } from '../stores';
import useChatData from './use-chat-data';
import useChatNavigation from './use-chat-navigation';
import useChatUIState from './use-chat-ui-state';
import useMessageActions from './use-message-actions';
import useGroupActions from './use-group-actions';
import useChatSocket from './use-chat-socket';
import useTypingIndicator from './use-typing-indicator';
import { getOtherParticipant } from '../utilities';
import type { User } from '@/modules/auth/api/entities/user';

const useMessagesPage = (chatId?: string) => {
    const { handleSelectChat } = useChatNavigation();
    const uiState = useChatUIState();

    // Auth
    const currentUser = useCurrentUser();
    const currentUserId = currentUser?._id;

    // Team
    const selectedTeam = useSelectedTeam();
    const selectedTeamId = useSelectedTeamId();
    const { members: teamMembers } = useTeamMemberData({ teamId: selectedTeamId });

    // Chat data from query cache
    const chatData = useChatData();
    const {
        chats,
        messages,
        currentChatId,
        hasMore: hasMoreMessages,
        page: currentPage,
        fetchChats,
        resetState,
        selectChat,
        loadMoreMessages,
        addMessage,
        updateMessage,
        isChatsLoading,
        isMessagesLoading
    } = chatData;

    // Presence store (not being removed)
    const typingUsers = useChatPresenceStore((state) => state.typingUsers);
    const userPresence = useChatPresenceStore((state) => state.userPresence);
    const resetPresenceStore = useChatPresenceStore((state) => state.reset);

    // Domain hooks
    const messageActions = useMessageActions({ chatId });
    const groupActions = useGroupActions();
    const { handleTyping } = useTypingIndicator(chatId);
    const previousTeamIdRef = useRef<string | undefined>(selectedTeamId ?? undefined);

    useChatSocket({ currentChatId: currentChatId ?? undefined, addMessage, updateMessage });

    // Memoized values
    const currentChat = useMemo(() => 
        chats.find((c) => c._id === chatId) || null, [chats, chatId]);

    const currentTypingUsers = useMemo(() => 
        typingUsers.filter((t) => t.chatId === chatId && t.userId !== currentUserId && t.isTyping), 
        [typingUsers, chatId, currentUserId]);

    const otherParticipantPresence = useMemo(() => {
        if (!currentChat || currentChat.isGroup) return 'unknown' as const;
        const other = getOtherParticipant(currentChat, currentUserId);
        return other ? (userPresence[other._id] || 'unknown') : 'unknown';
    }, [currentChat, currentUserId, userPresence]);

    const teamMembersAsUsers = useMemo((): User[] => 
        teamMembers.filter((m) => m.user._id !== currentUserId).map((m) => m.user), 
        [teamMembers, currentUserId]);

    // Effects
    useEffect(() => {
        const previousTeamId = previousTeamIdRef.current;
        const nextTeamId = selectedTeamId ?? undefined;

        if (previousTeamId === nextTeamId) {
            return;
        }

        previousTeamIdRef.current = nextTeamId;
        resetState();
        resetPresenceStore();

        if (nextTeamId) {
            fetchChats();
        }
    }, [fetchChats, resetPresenceStore, resetState, selectedTeamId]);

    useEffect(() => {
        if (chatId) selectChat(chatId);
    }, [chatId, selectChat]);

    useEffect(() => {
        return () => {
            resetState();
            resetPresenceStore();
        };
    }, [resetPresenceStore, resetState]);

    // Handlers
    const handleStartChat = useCallback(async (memberId: string) => {
        if (selectedTeam) await groupActions.getOrCreateChat(selectedTeam._id, memberId);
    }, [selectedTeam, groupActions.getOrCreateChat]);

    const handleLoadMore = useCallback(() => {
        if (chatId && hasMoreMessages) {
            loadMoreMessages(chatId, currentPage);
        }
    }, [chatId, currentPage, hasMoreMessages, loadMoreMessages]);

    const handleCreateGroup = useCallback(async (name: string, description: string, memberIds: string[]) => {
        if (!selectedTeam) return;
        await groupActions.createGroup({
            teamId: selectedTeam._id,
            groupName: name,
            groupDescription: description,
            participantIds: memberIds
        });
    }, [selectedTeam, groupActions.createGroup]);

    // Adapters for component props
    const handleSendFiles = useCallback(async (files: File[]) => {
        for (const file of files) await messageActions.sendFileMessage(file);
    }, [messageActions.sendFileMessage]);

    const handleUpdateGroupInfo = useCallback(async (_id: string, name: string, description: string) => {
        await groupActions.updateGroupInfo(_id, { groupName: name, groupDescription: description });
    }, [groupActions.updateGroupInfo]);

    const handleUpdateAdmins = useCallback(async (_id: string, adminIds: string[], action: 'add' | 'remove') => {
        await groupActions.updateGroupAdmins(_id, { targetUserIds: adminIds, action });
    }, [groupActions.updateGroupAdmins]);

    return {
        // State
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
        ...uiState,

        // Handlers
        handleSelectChat,
        handleStartChat,
        handleLoadMore,
        handleTyping,
        handleCreateGroup,
        handleSendFiles,
        handleUpdateGroupInfo,
        handleUpdateAdmins,

        // Direct operations
        sendMessage: messageActions.sendMessage,
        editMessage: messageActions.editMessage,
        deleteMessage: messageActions.deleteMessage,
        toggleReaction: messageActions.toggleReaction,
        addUsersToGroup: groupActions.addUsersToGroup,
        leaveGroup: groupActions.leaveGroup
    };
};

export default useMessagesPage;
