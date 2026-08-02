import {
    useCreateGroupMutation,
    useAddUsersToGroupMutation,
    useUpdateGroupInfoMutation,
    useUpdateGroupAdminsMutation,
    useLeaveGroupMutation
} from './queries';
import { addChatToCache, removeChatFromCache, replaceChatInCache } from '../chat/queries';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import type { CreateGroupChatInput, UpdateGroupAdminsInput, UpdateGroupInfoInput } from '@volt/contracts/modules/chat/http';
import { useNavigate } from 'react-router-dom';

const useGroupActions = () => {
    const navigate = useNavigate();

    const createGroupMutationResult = useCreateGroupMutation();
    const addUsersToGroupMutationResult = useAddUsersToGroupMutation();
    const updateGroupInfoMutationResult = useUpdateGroupInfoMutation();
    const updateGroupAdminsMutationResult = useUpdateGroupAdminsMutation();
    const leaveGroupMutationResult = useLeaveGroupMutation();

    const createGroup = async (input: CreateGroupChatInput) => {
        return runAction({
            action: () => createGroupMutationResult.mutateAsync(input),
            toast: createPromiseToastOptions({
                loading: 'Creating group...',
                success: 'Group created',
                error: 'Failed to create group'
            }),
            afterSuccess: (chat) => {
                addChatToCache(chat);
                navigate(`/dashboard/messages/${chat._id}`);
            }
        });
    };

    const addUsersToGroup = async (chatId: string, userIds: string[]) => {
        return runAction({
            action: () => addUsersToGroupMutationResult.mutateAsync({
                chatId,
                userIds
            }),
            toast: createPromiseToastOptions({
                loading: 'Adding members...',
                success: 'Members added to group',
                error: 'Failed to add members'
            }),
            afterSuccess: replaceChatInCache
        });
    };

    const updateGroupInfo = async (chatId: string, changes: UpdateGroupInfoInput) => {
        return runAction({
            action: () => updateGroupInfoMutationResult.mutateAsync({
                chatId,
                ...changes
            }),
            toast: createPromiseToastOptions({
                loading: 'Updating group...',
                success: 'Group updated',
                error: 'Failed to update group'
            }),
            afterSuccess: replaceChatInCache
        });
    };

    const updateGroupAdmins = async (chatId: string, changes: UpdateGroupAdminsInput) => {
        return runAction({
            action: () => updateGroupAdminsMutationResult.mutateAsync({
                chatId,
                ...changes
            }),
            toast: createPromiseToastOptions({
                loading: 'Updating admins...',
                success: 'Group admins updated',
                error: 'Failed to update admins'
            }),
            afterSuccess: replaceChatInCache
        });
    };

    const leaveGroup = async (chatId: string) => {
        await runAction({
            action: () => leaveGroupMutationResult.mutateAsync({ chatId }),
            toast: createPromiseToastOptions({
                loading: 'Leaving group...',
                success: 'You left the group',
                error: 'Failed to leave group'
            }),
            afterSuccess: () => {
                removeChatFromCache(chatId);
                navigate('/dashboard/messages');
            }
        });
    };

    return {
        createGroup,
        addUsersToGroup,
        updateGroupInfo,
        updateGroupAdmins,
        leaveGroup
    };
};

export default useGroupActions;
