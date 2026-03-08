import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import useSocket from '@/modules/socket/hooks/use-socket';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { CHAT_SOCKET_EVENTS } from '../api/entities/chat-constants';
import type { CreateGroupChatDTO } from '../api/dtos/create-group-chat';
import type { UpdateGroupInfoDTO } from '../api/dtos/update-group-info';
import type { UpdateGroupAdminsDTO } from '../api/dtos/update-group-admins';
import {
    addChatToCache,
    removeChatFromCache,
    replaceChatInCache,
    useCreateGroupMutation,
    useAddUsersToGroupMutation,
    useRemoveUsersFromGroupMutation,
    useUpdateGroupInfoMutation,
    useUpdateGroupAdminsMutation,
    useLeaveGroupMutation,
    useGetOrCreateChatMutation
} from './chat/queries';
import ApiError from '@/shared/errors/ApiError';

const useGroupActions = () => {
    const navigate = useNavigate();
    const socket = useSocket();
    const queryClient = useQueryClient();

    const createGroupMutationResult = useCreateGroupMutation();
    const addUsersToGroupMutationResult = useAddUsersToGroupMutation();
    const removeUsersFromGroupMutationResult = useRemoveUsersFromGroupMutation();
    const updateGroupInfoMutationResult = useUpdateGroupInfoMutation();
    const updateGroupAdminsMutationResult = useUpdateGroupAdminsMutation();
    const leaveGroupMutationResult = useLeaveGroupMutation();
    const getOrCreateChatMutationResult = useGetOrCreateChatMutation();

    const createGroup = useCallback(async (dto: CreateGroupChatDTO) => {
        try {
            const chat = await showPromise(createGroupMutationResult.mutateAsync(dto), {
                loading: { title: 'Creating group...' },
                success: { title: 'Group created' },
                error: { title: 'Failed to create group' }
            });
            addChatToCache(queryClient, chat);

            socket.emit(CHAT_SOCKET_EVENTS.GROUP_CREATED, { chatId: chat._id });
            navigate(`/dashboard/messages/${chat._id}`);

            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [createGroupMutationResult, queryClient, socket, navigate]);

    const addUsersToGroup = useCallback(async (chatId: string, userIds: string[]) => {
        try {
            const chat = await showPromise(
                addUsersToGroupMutationResult.mutateAsync({ chatId, userIds }),
                {
                    loading: { title: 'Adding members...' },
                    success: { title: 'Members added to group' },
                    error: { title: 'Failed to add members' }
                }
            );
            replaceChatInCache(queryClient, chat);

            socket.emit(CHAT_SOCKET_EVENTS.USERS_ADDED_TO_GROUP, { chatId, userIds });

            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [addUsersToGroupMutationResult, queryClient, socket]);

    const removeUsersFromGroup = useCallback(async (chatId: string, userIds: string[]) => {
        try {
            const chat = await showPromise(
                removeUsersFromGroupMutationResult.mutateAsync({ chatId, userIds }),
                {
                    loading: { title: 'Removing members...' },
                    success: { title: 'Members removed from group' },
                    error: { title: 'Failed to remove members' }
                }
            );
            replaceChatInCache(queryClient, chat);

            socket.emit(CHAT_SOCKET_EVENTS.USERS_REMOVED_FROM_GROUP, { chatId, userIds });

            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [removeUsersFromGroupMutationResult, queryClient, socket]);

    const updateGroupInfo = useCallback(async (chatId: string, dto: UpdateGroupInfoDTO) => {
        try {
            const chat = await showPromise(
                updateGroupInfoMutationResult.mutateAsync({ chatId, ...dto }),
                {
                    loading: { title: 'Updating group...' },
                    success: { title: 'Group updated' },
                    error: { title: 'Failed to update group' }
                }
            );
            replaceChatInCache(queryClient, chat);

            socket.emit(CHAT_SOCKET_EVENTS.GROUP_INFO_UPDATED, { chatId, ...dto });

            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [updateGroupInfoMutationResult, queryClient, socket]);

    const updateGroupAdmins = useCallback(async (chatId: string, dto: UpdateGroupAdminsDTO) => {
        try {
            const chat = await showPromise(
                updateGroupAdminsMutationResult.mutateAsync({ chatId, ...dto }),
                {
                    loading: { title: 'Updating admins...' },
                    success: { title: 'Group admins updated' },
                    error: { title: 'Failed to update admins' }
                }
            );
            replaceChatInCache(queryClient, chat);
            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [updateGroupAdminsMutationResult, queryClient]);

    const leaveGroup = useCallback(async (chatId: string) => {
        try {
            await showPromise(leaveGroupMutationResult.mutateAsync({ chatId }), {
                loading: { title: 'Leaving group...' },
                success: { title: 'You left the group' },
                error: { title: 'Failed to leave group' }
            });
            removeChatFromCache(queryClient, chatId);

            socket.emit(CHAT_SOCKET_EVENTS.USER_LEFT_GROUP, { chatId });
            navigate('/dashboard/messages');
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [leaveGroupMutationResult, queryClient, socket, navigate]);

    const getOrCreateChat = useCallback(async (teamId: string, participantId: string) => {
        try {
            const chat = await showPromise(
                getOrCreateChatMutationResult.mutateAsync({ teamId, participantId }),
                {
                    loading: { title: 'Opening chat...' },
                    success: { title: 'Chat ready' },
                    error: { title: 'Failed to open chat' }
                }
            );
            addChatToCache(queryClient, chat);
            navigate(`/dashboard/messages/${chat._id}`);
            return chat;
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
            throw error;
        }
    }, [getOrCreateChatMutationResult, queryClient, navigate]);

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
