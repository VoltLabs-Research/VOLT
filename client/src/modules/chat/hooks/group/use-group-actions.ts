import {
    useCreateGroupMutation,
    useAddUsersToGroupMutation,
    useRemoveUsersFromGroupMutation,
    useUpdateGroupInfoMutation,
    useUpdateGroupAdminsMutation,
    useLeaveGroupMutation
} from './queries';
import { addChatToCache, removeChatFromCache, replaceChatInCache } from '../chat/queries';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import type { CreateGroupChatParams } from '../../api/services/group-service';
import type { UpdateGroupAdminsInput, UpdateGroupInfoInput } from '@volt/contracts/modules/chat/http';
import { useNavigate } from 'react-router-dom';

const useGroupActions = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const createGroupMutationResult = useCreateGroupMutation();
    const addUsersToGroupMutationResult = useAddUsersToGroupMutation();
    const removeUsersFromGroupMutationResult = useRemoveUsersFromGroupMutation();
    const updateGroupInfoMutationResult = useUpdateGroupInfoMutation();
    const updateGroupAdminsMutationResult = useUpdateGroupAdminsMutation();
    const leaveGroupMutationResult = useLeaveGroupMutation();

    const createGroup = useCallback(async (input: CreateGroupChatParams) => {
        return runAction({
            action: () => createGroupMutationResult.mutateAsync(input),
            toast: createPromiseToastOptions({
                loading: 'Creating group...',
                success: 'Group created',
                error: 'Failed to create group'
            }),
            afterSuccess: (chat) => {
                addChatToCache(queryClient, chat);
                navigate(`/dashboard/messages/${chat._id}`);
            }
        });
    }, [createGroupMutationResult, queryClient, navigate]);

    const addUsersToGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return runAction({
            action: () => addUsersToGroupMutationResult.mutateAsync({ chatId, userIds }),
            toast: createPromiseToastOptions({
                loading: 'Adding members...',
                success: 'Members added to group',
                error: 'Failed to add members'
            }),
            afterSuccess: (chat) => {
                replaceChatInCache(queryClient, chat);
            }
        });
    }, [addUsersToGroupMutationResult, queryClient]);

    const removeUsersFromGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return runAction({
            action: () => removeUsersFromGroupMutationResult.mutateAsync({ chatId, userIds }),
            toast: createPromiseToastOptions({
                loading: 'Removing members...',
                success: 'Members removed from group',
                error: 'Failed to remove members'
            }),
            afterSuccess: (chat) => {
                replaceChatInCache(queryClient, chat);
            }
        });
    }, [queryClient, removeUsersFromGroupMutationResult]);

    const updateGroupInfo = useCallback(async (chatId: string, changes: UpdateGroupInfoInput) => {
        return runAction({
            action: () => updateGroupInfoMutationResult.mutateAsync({ chatId, ...changes }),
            toast: createPromiseToastOptions({
                loading: 'Updating group...',
                success: 'Group updated',
                error: 'Failed to update group'
            }),
            afterSuccess: (chat) => {
                replaceChatInCache(queryClient, chat);
            }
        });
    }, [queryClient, updateGroupInfoMutationResult]);

    const updateGroupAdmins = useCallback(async (chatId: string, changes: UpdateGroupAdminsInput) => {
        return runAction({
            action: () => updateGroupAdminsMutationResult.mutateAsync({ chatId, ...changes }),
            toast: createPromiseToastOptions({
                loading: 'Updating admins...',
                success: 'Group admins updated',
                error: 'Failed to update admins'
            }),
            afterSuccess: (chat) => {
                replaceChatInCache(queryClient, chat);
            }
        });
    }, [queryClient, updateGroupAdminsMutationResult]);

    const leaveGroup = useCallback(async (chatId: string) => {
        await runAction({
            action: () => leaveGroupMutationResult.mutateAsync({ chatId }),
            toast: createPromiseToastOptions({
                loading: 'Leaving group...',
                success: 'You left the group',
                error: 'Failed to leave group'
            }),
            afterSuccess: () => {
                removeChatFromCache(queryClient, chatId);
                navigate('/dashboard/messages');
            }
        });
    }, [leaveGroupMutationResult, queryClient, navigate]);

    return {
        createGroup,
        addUsersToGroup,
        removeUsersFromGroup,
        updateGroupInfo,
        updateGroupAdmins,
        leaveGroup
    };
};

export default useGroupActions;
