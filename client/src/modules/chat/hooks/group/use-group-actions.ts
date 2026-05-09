import {
    useCreateGroupMutation,
    useAddUsersToGroupMutation,
    useRemoveUsersFromGroupMutation,
    useUpdateGroupInfoMutation,
    useUpdateGroupAdminsMutation,
    useLeaveGroupMutation
} from './queries';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    addUsersToGroupAction,
    createGroupAction,
    leaveGroupAction,
    removeUsersFromGroupAction,
    updateGroupAdminsAction,
    updateGroupInfoAction
} from '../../services/group/actions';
import type { CreateGroupChatDTO, UpdateGroupAdminsDTO, UpdateGroupInfoDTO } from '../../api/services/group-service';
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

    const createGroup = useCallback(async (dto: CreateGroupChatDTO) => {
        return createGroupAction(
            { queryClient, navigate },
            createGroupMutationResult.mutateAsync,
            dto
        );
    }, [createGroupMutationResult, queryClient, navigate]);

    const addUsersToGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return addUsersToGroupAction(
            { queryClient, navigate },
            addUsersToGroupMutationResult.mutateAsync,
            chatId,
            userIds
        );
    }, [addUsersToGroupMutationResult, navigate, queryClient]);

    const removeUsersFromGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return removeUsersFromGroupAction(
            { queryClient, navigate },
            removeUsersFromGroupMutationResult.mutateAsync,
            chatId,
            userIds
        );
    }, [navigate, queryClient, removeUsersFromGroupMutationResult]);

    const updateGroupInfo = useCallback(async (chatId: string, dto: UpdateGroupInfoDTO) => {
        return updateGroupInfoAction(
            { queryClient, navigate },
            updateGroupInfoMutationResult.mutateAsync,
            chatId,
            dto
        );
    }, [navigate, queryClient, updateGroupInfoMutationResult]);

    const updateGroupAdmins = useCallback(async (chatId: string, dto: UpdateGroupAdminsDTO) => {
        return updateGroupAdminsAction(
            { queryClient, navigate },
            updateGroupAdminsMutationResult.mutateAsync,
            chatId,
            dto
        );
    }, [navigate, queryClient, updateGroupAdminsMutationResult]);

    const leaveGroup = useCallback(async (chatId: string) => {
        return leaveGroupAction(
            { queryClient, navigate },
            leaveGroupMutationResult.mutateAsync,
            chatId
        );
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
