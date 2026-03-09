import { addChatToCache, removeChatFromCache, replaceChatInCache } from '../../hooks/chat/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';
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

const swallowRBACError = (error: unknown) => {
    if (ApiError.isRBACError(error)) {
        return;
    }

    throw error;
};

export const createGroupAction = async (
    dependencies: GroupActionDependencies,
    createGroupMutation: (dto: CreateGroupChatDTO) => Promise<Chat>,
    dto: CreateGroupChatDTO
) => {
    const { queryClient, navigate } = dependencies;

    try {
        const chat = await showPromise(createGroupMutation(dto), {
            loading: { title: 'Creating group...' },
            success: { title: 'Group created' },
            error: { title: 'Failed to create group' }
        });

        addChatToCache(queryClient, chat);
        navigate(`/dashboard/messages/${chat._id}`);

        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};

export const addUsersToGroupAction = async (
    dependencies: GroupActionDependencies,
    addUsersToGroupMutation: (input: { chatId: string; userIds: string[] }) => Promise<Chat>,
    chatId: string,
    userIds: string[]
) => {
    const { queryClient } = dependencies;

    try {
        const chat = await showPromise(addUsersToGroupMutation({ chatId, userIds }), {
            loading: { title: 'Adding members...' },
            success: { title: 'Members added to group' },
            error: { title: 'Failed to add members' }
        });

        replaceChatInCache(queryClient, chat);
        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};

export const removeUsersFromGroupAction = async (
    dependencies: GroupActionDependencies,
    removeUsersFromGroupMutation: (input: { chatId: string; userIds: string[] }) => Promise<Chat>,
    chatId: string,
    userIds: string[]
) => {
    const { queryClient } = dependencies;

    try {
        const chat = await showPromise(removeUsersFromGroupMutation({ chatId, userIds }), {
            loading: { title: 'Removing members...' },
            success: { title: 'Members removed from group' },
            error: { title: 'Failed to remove members' }
        });

        replaceChatInCache(queryClient, chat);
        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};

export const updateGroupInfoAction = async (
    dependencies: GroupActionDependencies,
    updateGroupInfoMutation: (input: { chatId: string } & UpdateGroupInfoDTO) => Promise<Chat>,
    chatId: string,
    dto: UpdateGroupInfoDTO
) => {
    const { queryClient } = dependencies;

    try {
        const chat = await showPromise(updateGroupInfoMutation({ chatId, ...dto }), {
            loading: { title: 'Updating group...' },
            success: { title: 'Group updated' },
            error: { title: 'Failed to update group' }
        });

        replaceChatInCache(queryClient, chat);
        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};

export const updateGroupAdminsAction = async (
    dependencies: GroupActionDependencies,
    updateGroupAdminsMutation: (input: { chatId: string } & UpdateGroupAdminsDTO) => Promise<Chat>,
    chatId: string,
    dto: UpdateGroupAdminsDTO
) => {
    const { queryClient } = dependencies;

    try {
        const chat = await showPromise(updateGroupAdminsMutation({ chatId, ...dto }), {
            loading: { title: 'Updating admins...' },
            success: { title: 'Group admins updated' },
            error: { title: 'Failed to update admins' }
        });

        replaceChatInCache(queryClient, chat);

        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};

export const leaveGroupAction = async (
    dependencies: GroupActionDependencies,
    leaveGroupMutation: (input: { chatId: string }) => Promise<void>,
    chatId: string
) => {
    const { queryClient, navigate } = dependencies;

    try {
        await showPromise(leaveGroupMutation({ chatId }), {
            loading: { title: 'Leaving group...' },
            success: { title: 'You left the group' },
            error: { title: 'Failed to leave group' }
        });

        removeChatFromCache(queryClient, chatId);
        navigate('/dashboard/messages');
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};
