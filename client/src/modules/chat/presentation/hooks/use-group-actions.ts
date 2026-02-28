import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { container } from 'tsyringe';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useChatStore } from '../stores';
import { CHAT_TOKENS } from '@/modules/chat/infrastructure/di/tokens';
import { CHAT_SOCKET_EVENTS } from '@/modules/chat/domain/constants';
import type IChatRepository from '@/modules/chat/domain/ports/IChatRepository';
import type { CreateGroupChatDTO, UpdateGroupInfoDTO, UpdateGroupAdminsDTO } from '@/modules/chat/application/dtos';

const useGroupActions = () => {
    const navigate = useNavigate();
    const socket = useSocket();
    const addChat = useChatStore((state) => state.addChat);
    const updateChat = useChatStore((state) => state.updateChat);
    const removeChat = useChatStore((state) => state.removeChat);

    const chatRepository = useMemo(
        () => container.resolve<IChatRepository>(CHAT_TOKENS.ChatRepository),
        []
    );

    const createGroup = useCallback(async (dto: CreateGroupChatDTO) => {
        const chat = await showPromise(chatRepository.createGroup(dto), {
            loading: { title: 'Creating group...' },
            success: { title: 'Group created' },
            error: { title: 'Failed to create group' }
        });
        addChat(chat);

        socket.emit(CHAT_SOCKET_EVENTS.GROUP_CREATED, { chatId: chat._id });
        navigate(`/dashboard/messages/${chat._id}`);

        return chat;
    }, [chatRepository, addChat, socket, navigate]);

    const addUsersToGroup = useCallback(async (chatId: string, userIds: string[]) => {
        const chat = await showPromise(chatRepository.addUsersToGroup(chatId, userIds), {
            loading: { title: 'Adding members...' },
            success: { title: 'Members added to group' },
            error: { title: 'Failed to add members' }
        });
        updateChat(chatId, chat);

        socket.emit(CHAT_SOCKET_EVENTS.USERS_ADDED_TO_GROUP, { chatId, userIds });

        return chat;
    }, [chatRepository, updateChat, socket]);

    const removeUsersFromGroup = useCallback(async (chatId: string, userIds: string[]) => {
        const chat = await showPromise(chatRepository.removeUsersFromGroup(chatId, userIds), {
            loading: { title: 'Removing members...' },
            success: { title: 'Members removed from group' },
            error: { title: 'Failed to remove members' }
        });
        updateChat(chatId, chat);

        socket.emit(CHAT_SOCKET_EVENTS.USERS_REMOVED_FROM_GROUP, { chatId, userIds });

        return chat;
    }, [chatRepository, updateChat, socket]);

    const updateGroupInfo = useCallback(async (chatId: string, dto: UpdateGroupInfoDTO) => {
        const chat = await showPromise(chatRepository.updateGroupInfo(chatId, dto), {
            loading: { title: 'Updating group...' },
            success: { title: 'Group updated' },
            error: { title: 'Failed to update group' }
        });
        updateChat(chatId, chat);

        socket.emit(CHAT_SOCKET_EVENTS.GROUP_INFO_UPDATED, { chatId, ...dto });

        return chat;
    }, [chatRepository, updateChat, socket]);

    const updateGroupAdmins = useCallback(async (chatId: string, dto: UpdateGroupAdminsDTO) => {
        const chat = await showPromise(chatRepository.updateGroupAdmins(chatId, dto), {
            loading: { title: 'Updating admins...' },
            success: { title: 'Group admins updated' },
            error: { title: 'Failed to update admins' }
        });
        updateChat(chatId, chat);
        return chat;
    }, [chatRepository, updateChat]);

    const leaveGroup = useCallback(async (chatId: string) => {
        await showPromise(chatRepository.leaveGroup(chatId), {
            loading: { title: 'Leaving group...' },
            success: { title: 'You left the group' },
            error: { title: 'Failed to leave group' }
        });
        removeChat(chatId);

        socket.emit(CHAT_SOCKET_EVENTS.USER_LEFT_GROUP, { chatId });
        navigate('/dashboard/messages');
    }, [chatRepository, removeChat, socket, navigate]);

    const getOrCreateChat = useCallback(async (teamId: string, participantId: string) => {
        const chat = await showPromise(chatRepository.getOrCreate(teamId, participantId), {
            loading: { title: 'Opening chat...' },
            success: { title: 'Chat ready' },
            error: { title: 'Failed to open chat' }
        });
        addChat(chat);
        navigate(`/dashboard/messages/${chat._id}`);
        return chat;
    }, [chatRepository, addChat, navigate]);

    return {
        createGroup,
        addUsersToGroup,
        removeUsersFromGroup,
        updateGroupInfo,
        updateGroupAdmins,
        leaveGroup,
        getOrCreateChat
    };
};

export default useGroupActions;
