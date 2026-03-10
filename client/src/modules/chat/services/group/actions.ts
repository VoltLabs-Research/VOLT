import { addChatToCache, removeChatFromCache, replaceChatInCache } from '../../hooks/chat/queries';
import { runHandledAction } from '@/shared/errors/handled-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import type { Chat } from '../../api/entities/chat';
import type { CreateGroupChatDTO, UpdateGroupAdminsDTO, UpdateGroupInfoDTO } from '../../api/dtos/group';

interface SocketLike {
    emit: (event: string, payload?: unknown) => unknown;
};

interface GroupActionDependencies {
    queryClient: QueryClient;
    socket: SocketLike;
    navigate: NavigateFunction;
};

export const createGroupAction = async (
    dependencies: GroupActionDependencies,
    createGroupMutation: (dto: CreateGroupChatDTO) => Promise<Chat>,
    dto: CreateGroupChatDTO
) => {
    const { queryClient, navigate } = dependencies;

    return await runHandledAction({
        action: () => createGroupMutation(dto),
        toast: createPromiseToastOptions({
            loading: 'Creating group...',
            success: 'Group created',
            error: 'Failed to create group'
        }),
        afterSuccess: (chat) => {
            addChatToCache(queryClient, chat);
            navigate(`/dashboard/messages/${chat._id}`);
        },
        rethrow: false
    });
};

export const addUsersToGroupAction = async (
    dependencies: GroupActionDependencies,
    addUsersToGroupMutation: (input: { chatId: string; userIds: string[] }) => Promise<Chat>,
    chatId: string,
    userIds: string[]
) => {
    const { queryClient } = dependencies;

    return await runHandledAction({
        action: () => addUsersToGroupMutation({ chatId, userIds }),
        toast: createPromiseToastOptions({
            loading: 'Adding members...',
            success: 'Members added to group',
            error: 'Failed to add members'
        }),
        afterSuccess: (chat) => {
            replaceChatInCache(queryClient, chat);
        },
        rethrow: false
    });
};

export const removeUsersFromGroupAction = async (
    dependencies: GroupActionDependencies,
    removeUsersFromGroupMutation: (input: { chatId: string; userIds: string[] }) => Promise<Chat>,
    chatId: string,
    userIds: string[]
) => {
    const { queryClient } = dependencies;

    return await runHandledAction({
        action: () => removeUsersFromGroupMutation({ chatId, userIds }),
        toast: createPromiseToastOptions({
            loading: 'Removing members...',
            success: 'Members removed from group',
            error: 'Failed to remove members'
        }),
        afterSuccess: (chat) => {
            replaceChatInCache(queryClient, chat);
        },
        rethrow: false
    });
};

export const updateGroupInfoAction = async (
    dependencies: GroupActionDependencies,
    updateGroupInfoMutation: (input: { chatId: string } & UpdateGroupInfoDTO) => Promise<Chat>,
    chatId: string,
    dto: UpdateGroupInfoDTO
) => {
    const { queryClient } = dependencies;

    return await runHandledAction({
        action: () => updateGroupInfoMutation({ chatId, ...dto }),
        toast: createPromiseToastOptions({
            loading: 'Updating group...',
            success: 'Group updated',
            error: 'Failed to update group'
        }),
        afterSuccess: (chat) => {
            replaceChatInCache(queryClient, chat);
        },
        rethrow: false
    });
};

export const updateGroupAdminsAction = async (
    dependencies: GroupActionDependencies,
    updateGroupAdminsMutation: (input: { chatId: string } & UpdateGroupAdminsDTO) => Promise<Chat>,
    chatId: string,
    dto: UpdateGroupAdminsDTO
) => {
    const { queryClient } = dependencies;

    return await runHandledAction({
        action: () => updateGroupAdminsMutation({ chatId, ...dto }),
        toast: createPromiseToastOptions({
            loading: 'Updating admins...',
            success: 'Group admins updated',
            error: 'Failed to update admins'
        }),
        afterSuccess: (chat) => {
            replaceChatInCache(queryClient, chat);
        },
        rethrow: false
    });
};

export const leaveGroupAction = async (
    dependencies: GroupActionDependencies,
    leaveGroupMutation: (input: { chatId: string }) => Promise<void>,
    chatId: string
) => {
    const { queryClient, navigate } = dependencies;

    await runHandledAction({
        action: () => leaveGroupMutation({ chatId }),
        toast: createPromiseToastOptions({
            loading: 'Leaving group...',
            success: 'You left the group',
            error: 'Failed to leave group'
        }),
        afterSuccess: () => {
            removeChatFromCache(queryClient, chatId);
            navigate('/dashboard/messages');
        },
        rethrow: false
    });
};
