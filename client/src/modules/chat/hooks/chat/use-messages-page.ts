import { PresenceStatus } from '../../api/entities/shared/chat-events';
import { useChatPresenceStore } from '../../stores/chat/use-chat-presence-store';
import { getOtherParticipant } from '../../utilities/chat/chat-display';
import useChatData from './use-chat-data';
import useChatActions from './use-chat-actions';
import useChatNavigation from './use-chat-navigation';
import useChatSocket from './use-chat-socket';
import useChatUIState from './use-chat-ui-state';
import useGroupActions from '../group/use-group-actions';
import useMessageActions from '../message/use-message-actions';
import useTypingIndicator from '../message/use-typing-indicator';
import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSelectedTeam, useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import type { User } from '@/modules/auth/api/entities/user';

const useMessagesPage = (chatId?: string) => {
    const { handleSelectChat, navigateToMessages } = useChatNavigation();
    const uiState = useChatUIState();
    const { closeDetails, toggleDetails } = uiState;

    const currentUser = useCurrentUser();
    const currentUserId = currentUser?._id;

    const selectedTeam = useSelectedTeam();
    const selectedTeamId = useSelectedTeamId();
    const { members: teamMembers } = useTeamMemberData({ teamId: selectedTeamId });

    const chatData = useChatData();
    const {
        chats,
        messages,
        currentChatId,
        hasMore: hasMoreMessages,
        fetchChats,
        resetState,
        selectChat,
        loadMoreMessages,
        addMessage,
        updateMessage,
        isChatsLoading,
        isMessagesLoading,
        chatsError,
        messagesError
    } = chatData;

    const typingUsers = useChatPresenceStore((state) => state.typingUsers);
    const userPresence = useChatPresenceStore((state) => state.userPresence);
    const resetPresenceStore = useChatPresenceStore((state) => state.reset);

    const messageActions = useMessageActions({ chatId });
    const chatActions = useChatActions();
    const groupActions = useGroupActions();
    const { handleTyping } = useTypingIndicator(chatId);
    const previousTeamIdRef = useRef<string | undefined>(selectedTeamId ?? undefined);
    const handleInfoClick = toggleDetails;

    useChatSocket({
        currentChatId: currentChatId ?? undefined,
        addMessage,
        updateMessage
    });

    const currentChat = useMemo(() => {
        return chats.find((c) => c._id === chatId) || null;
    }, [chats, chatId]);

    const currentTypingUsers = useMemo(() => {
        return typingUsers.filter((typingUser) => {
            return typingUser.chatId === chatId
                && typingUser.userId !== currentUserId
                && typingUser.isTyping;
        });
    }, [typingUsers, chatId, currentUserId]);

    const otherParticipantPresence = useMemo(() => {
        if (!currentChat || currentChat.isGroup) {
            return PresenceStatus.Unknown;
        }

        const other = getOtherParticipant(currentChat, currentUserId);
        if (other) {
            return userPresence[other._id] || PresenceStatus.Unknown;
        }

        return PresenceStatus.Unknown;
    }, [currentChat, currentUserId, userPresence]);

    const teamMembersAsUsers = useMemo((): User[] => {
        return teamMembers.filter((member) => member.user._id !== currentUserId).map((member) => member.user);
    }, [teamMembers, currentUserId]);

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
        if (!chatId) {
            closeDetails();
            return;
        }

        let ignore = false;

        void selectChat(chatId).catch((error: unknown) => {
            if (ignore) {
                return;
            }

            closeDetails();
            resetState();
            resetPresenceStore();
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Unable to open this chat.'
            });
            navigateToMessages();
        });

        return () => {
            ignore = true;
        };
    }, [chatId, closeDetails, navigateToMessages, resetPresenceStore, resetState, selectChat]);

    useEffect(() => {
        return () => {
            resetState();
            resetPresenceStore();
        };
    }, [resetPresenceStore, resetState]);

    const handleSelectConversation = useCallback((nextChatId: string) => {
        closeDetails();
        handleSelectChat(nextChatId);
    }, [closeDetails, handleSelectChat]);

    const handleStartChat = useCallback(async (memberId: string) => {
        if (selectedTeam) await chatActions.getOrCreateChat(selectedTeam._id, memberId);
    }, [selectedTeam, chatActions]);

    const handleBackToList = useCallback(() => {
        closeDetails();
        navigateToMessages();
    }, [closeDetails, navigateToMessages]);

    const handleLoadMore = useCallback(() => {
        if (chatId && hasMoreMessages) {
            loadMoreMessages();
        }
    }, [chatId, hasMoreMessages, loadMoreMessages]);

    const handleCreateGroup = useCallback(async (name: string, description: string, memberIds: string[]) => {
        if (!selectedTeam) return;
        await groupActions.createGroup({
            teamId: selectedTeam._id,
            groupName: name,
            groupDescription: description,
            participantIds: memberIds
        });
    }, [selectedTeam, groupActions.createGroup]);

    const handleSendFiles = useCallback(async (files: File[]) => {
        for (const file of files) await messageActions.sendFileMessage(file);
    }, [messageActions.sendFileMessage]);

    const handleUpdateGroupInfo = useCallback(async (_id: string, name: string, description: string) => {
        await groupActions.updateGroupInfo(_id, {
            groupName: name,
            groupDescription: description
        });
    }, [groupActions.updateGroupInfo]);

    const handleUpdateAdmins = useCallback(async (_id: string, adminIds: string[], action: 'add' | 'remove') => {
        await groupActions.updateGroupAdmins(_id, {
            targetUserIds: adminIds,
            action
        });
    }, [groupActions.updateGroupAdmins]);

    return {
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
        messagesError,
        ...uiState,

        handleSelectChat: handleSelectConversation,
        handleStartChat,
        handleBackToList,
        handleLoadMore,
        handleTyping,
        handleCreateGroup,
        handleSendFiles,
        handleUpdateGroupInfo,
        handleUpdateAdmins,
        handleInfoClick,

        sendMessage: messageActions.sendMessage,
        isSendingMessage: messageActions.isSendingMessage,
        isSendingFile: messageActions.isSendingFile,
        editMessage: messageActions.editMessage,
        deleteMessage: messageActions.deleteMessage,
        toggleReaction: messageActions.toggleReaction,
        addUsersToGroup: groupActions.addUsersToGroup,
        leaveGroup: groupActions.leaveGroup
    };
};

export default useMessagesPage;
