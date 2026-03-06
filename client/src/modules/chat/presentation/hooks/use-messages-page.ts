import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import useTeamMemberData from '@/modules/team/presentation/hooks/team-member/use-team-member-data';
import { useChatStore, useChatMessageStore, useChatPresenceStore } from '../stores';
import useChatData from './use-chat-data';
import useChatNavigation from './use-chat-navigation';
import useChatUIState from './use-chat-ui-state';
import useMessageActions from './use-message-actions';
import useGroupActions from './use-group-actions';
import useChatSocket from './use-chat-socket';
import useTypingIndicator from './use-typing-indicator';
import { getOtherParticipant } from '../utilities';
import type { User } from '@/modules/auth/domain/entities';

const useMessagesPage = (chatId?: string) => {
    const { handleSelectChat } = useChatNavigation();
    const uiState = useChatUIState();

    // Auth
    const currentUser = useAuthStore((state) => state.user);
    const currentUserId = currentUser?._id;

    // Team
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const teamMembers = useTeamMemberStore((state) => state.members);
    const { fetchMembers } = useTeamMemberData();

    // Chat stores
    const chats = useChatStore((state) => state.chats);
    const isChatsLoading = useChatStore((state) => state.isLoading);
    const messages = useChatMessageStore((state) => state.messages);
    const isMessagesLoading = useChatMessageStore((state) => state.isLoading);
    const hasMoreMessages = useChatMessageStore((state) => state.hasMore);
    const currentPage = useChatMessageStore((state) => state.page);
    const typingUsers = useChatPresenceStore((state) => state.typingUsers);
    const userPresence = useChatPresenceStore((state) => state.userPresence);
    const resetPresenceStore = useChatPresenceStore((state) => state.reset);

    // Domain hooks
    const chatData = useChatData();
    const messageActions = useMessageActions(chatId);
    const groupActions = useGroupActions();
    const { handleTyping } = useTypingIndicator(chatId);
    const previousTeamIdRef = useRef<string | undefined>(selectedTeam?._id);
    const { fetchChats, resetState, selectChat, loadMoreMessages } = chatData;

    useChatSocket(chatId);

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
        fetchChats();
    }, [fetchChats]);

    useEffect(() => {
        if (selectedTeam?._id) fetchMembers(selectedTeam._id);
    }, [selectedTeam?._id, fetchMembers]);

    useEffect(() => {
        const previousTeamId = previousTeamIdRef.current;
        const nextTeamId = selectedTeam?._id;

        if (previousTeamId === nextTeamId) {
            return;
        }

        previousTeamIdRef.current = nextTeamId;
        resetState();
        resetPresenceStore();

        if (nextTeamId) {
            fetchChats();
        }
    }, [fetchChats, resetPresenceStore, resetState, selectedTeam?._id]);

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
        if (chatId && hasMoreMessages && !isMessagesLoading) {
            loadMoreMessages(chatId, currentPage);
        }
    }, [chatId, currentPage, hasMoreMessages, isMessagesLoading, loadMoreMessages]);

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

    const handleUpdateGroupInfo = useCallback(async (id: string, name: string, description: string) => {
        await groupActions.updateGroupInfo(id, { groupName: name, groupDescription: description });
    }, [groupActions.updateGroupInfo]);

    const handleUpdateAdmins = useCallback(async (id: string, adminIds: string[], action: 'add' | 'remove') => {
        await groupActions.updateGroupAdmins(id, { targetUserIds: adminIds, action });
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
