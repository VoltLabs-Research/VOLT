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
import { useNavigate } from 'react-router-dom';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import {
    addUsersToGroupAction,
    createGroupAction,
    leaveGroupAction,
    removeUsersFromGroupAction,
    updateGroupAdminsAction,
    updateGroupInfoAction
} from '../../services/group/actions';
import type { CreateGroupChatDTO, UpdateGroupAdminsDTO, UpdateGroupInfoDTO } from '../../api/dtos/group';

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

    const createGroup = useCallback(async (dto: CreateGroupChatDTO) => {
        return createGroupAction(
            { queryClient, socket, navigate },
            createGroupMutationResult.mutateAsync,
            dto
        );
    }, [createGroupMutationResult, queryClient, socket, navigate]);

    const addUsersToGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return addUsersToGroupAction(
            { queryClient, socket, navigate },
            addUsersToGroupMutationResult.mutateAsync,
            chatId,
            userIds
        );
    }, [addUsersToGroupMutationResult, navigate, queryClient, socket]);

    const removeUsersFromGroup = useCallback(async (chatId: string, userIds: string[]) => {
        return removeUsersFromGroupAction(
            { queryClient, socket, navigate },
            removeUsersFromGroupMutationResult.mutateAsync,
            chatId,
            userIds
        );
    }, [navigate, queryClient, removeUsersFromGroupMutationResult, socket]);

    const updateGroupInfo = useCallback(async (chatId: string, dto: UpdateGroupInfoDTO) => {
        return updateGroupInfoAction(
            { queryClient, socket, navigate },
            updateGroupInfoMutationResult.mutateAsync,
            chatId,
            dto
        );
    }, [navigate, queryClient, socket, updateGroupInfoMutationResult]);

    const updateGroupAdmins = useCallback(async (chatId: string, dto: UpdateGroupAdminsDTO) => {
        return updateGroupAdminsAction(
            { queryClient, socket, navigate },
            updateGroupAdminsMutationResult.mutateAsync,
            chatId,
            dto
        );
    }, [navigate, queryClient, socket, updateGroupAdminsMutationResult]);

    const leaveGroup = useCallback(async (chatId: string) => {
        return leaveGroupAction(
            { queryClient, socket, navigate },
            leaveGroupMutationResult.mutateAsync,
            chatId
        );
    }, [leaveGroupMutationResult, queryClient, socket, navigate]);

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
