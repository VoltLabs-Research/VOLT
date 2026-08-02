import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { useChatPresenceStore } from '../../store/chat/use-chat-presence-store';
import { getOtherParticipant } from '../../utils/chat/chat-display';
import { invalidateChatsQuery } from './queries';
import useChatData from './use-chat-data';
import useChatActions from './use-chat-actions';
import useChatSocket from './use-chat-socket';
import useGroupActions from '../group/use-group-actions';
import useMessageActions from '../message/use-message-actions';
import useTypingIndicator from '../message/use-typing-indicator';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSelectedTeam, useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useNavigate } from 'react-router-dom';

const useMessagesPage = (chatId?: string) => {
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);
    const closeDetails = useCallback(() => setShowDetails(false), []);
    const toggleDetails = () => setShowDetails((previous) => !previous);

    const currentUserId = useCurrentUser()?._id;

    const selectedTeam = useSelectedTeam();
    const selectedTeamId = useSelectedTeamId();
    const { members: teamMembers } = useTeamMemberData({ teamId: selectedTeamId });

    const {
        chats,
        messages,
        currentChatId,
        hasMore: hasMoreMessages,
        resetState,
        selectChat,
        loadMoreMessages,
        isChatsLoading,
        isMessagesLoading,
        chatsError
    } = useChatData();

    const typingUsers = useChatPresenceStore((state) => state.typingUsers);
    const userPresence = useChatPresenceStore((state) => state.userPresence);
    const resetPresenceStore = useChatPresenceStore((state) => state.reset);

    const messageActions = useMessageActions(currentChatId ?? chatId);
    const chatActions = useChatActions();
    const groupActions = useGroupActions();
    const { handleTyping } = useTypingIndicator(currentChatId);
    const previousTeamIdRef = useRef(selectedTeamId);

    useChatSocket(currentChatId);

    const currentChat = chats.find((chat) => chat._id === chatId) ?? null;

    const currentTypingUsers = typingUsers.filter((typingUser) => (
        typingUser.chatId === chatId
        && typingUser.userId !== currentUserId
        && typingUser.isTyping
    ));

    const otherParticipant = currentChat && !currentChat.isGroup
        ? getOtherParticipant(currentChat, currentUserId)
        : undefined;
    const otherParticipantPresence = otherParticipant
        ? userPresence[otherParticipant._id] || PresenceStatus.Unknown
        : PresenceStatus.Unknown;

    const teamMembersAsUsers = teamMembers
        .filter((member) => member.user._id !== currentUserId)
        .map((member) => member.user);

    useEffect(() => {
        if (previousTeamIdRef.current === selectedTeamId) {
            return;
        }

        previousTeamIdRef.current = selectedTeamId;
        resetState();
        resetPresenceStore();

        if (selectedTeamId) {
            invalidateChatsQuery().catch(() => undefined);
        }
    }, [resetPresenceStore, resetState, selectedTeamId]);

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
            navigate('/dashboard/messages');
        });

        return () => {
            ignore = true;
        };
    }, [chatId, closeDetails, navigate, resetPresenceStore, resetState, selectChat]);

    useEffect(() => {
        return () => {
            resetState();
            resetPresenceStore();
        };
    }, [resetPresenceStore, resetState]);

    const handleSelectConversation = (nextChatId: string) => {
        closeDetails();
        navigate(`/dashboard/messages/${nextChatId}`);
    };

    const handleStartChat = async (memberId: string) => {
        if (selectedTeam) await chatActions.getOrCreateChat(selectedTeam._id, memberId);
    };

    const handleBackToList = () => {
        closeDetails();
        navigate('/dashboard/messages');
    };

    const handleLoadMore = () => {
        if (chatId && hasMoreMessages) {
            loadMoreMessages();
        }
    };

    const handleCreateGroup = async (name: string, description: string, memberIds: string[]) => {
        if (!selectedTeam) return;

        await groupActions.createGroup({
            teamId: selectedTeam._id,
            groupName: name,
            groupDescription: description,
            participantIds: memberIds
        });
    };

    const handleSendFiles = async (files: File[]) => {
        for (const file of files) await messageActions.sendFileMessage(file);
    };

    const handleUpdateGroupInfo = async (_id: string, name: string, description: string) => {
        await groupActions.updateGroupInfo(_id, {
            groupName: name,
            groupDescription: description
        });
    };

    const handleUpdateAdmins = async (_id: string, adminIds: string[], action: 'add' | 'remove') => {
        await groupActions.updateGroupAdmins(_id, {
            targetUserIds: adminIds,
            action
        });
    };

    return {
        ...messageActions,
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
        toggleDetails,
        closeDetails,

        handleSelectChat: handleSelectConversation,
        handleStartChat,
        handleBackToList,
        handleLoadMore,
        handleTyping,
        handleCreateGroup,
        handleSendFiles,
        handleUpdateGroupInfo,
        handleUpdateAdmins,

        addUsersToGroup: groupActions.addUsersToGroup,
        leaveGroup: groupActions.leaveGroup
    };
};

export default useMessagesPage;
