import { createMutation } from '@/shared/infrastructure/query';
import groupService from '../../api/services/group-service';
import type { Chat } from '../../api/entities/chat';
import type {
    AddUsersToGroupInputDTO,
    CreateGroupChatDTO,
    RemoveUsersFromGroupInputDTO,
    UpdateGroupAdminsInputDTO,
    UpdateGroupInfoInputDTO
} from '../../api/dtos/group';

interface LeaveGroupParams {
    chatId: string;
}

export const useCreateGroupMutation = createMutation<Chat, CreateGroupChatDTO>(groupService.createGroup);
export const useAddUsersToGroupMutation = createMutation<Chat, AddUsersToGroupInputDTO>(groupService.addUsersToGroup);
export const useRemoveUsersFromGroupMutation = createMutation<Chat, RemoveUsersFromGroupInputDTO>(groupService.removeUsersFromGroup);
export const useUpdateGroupInfoMutation = createMutation<Chat, UpdateGroupInfoInputDTO>(groupService.updateGroupInfo);
export const useUpdateGroupAdminsMutation = createMutation<Chat, UpdateGroupAdminsInputDTO>(groupService.updateGroupAdmins);
export const useLeaveGroupMutation = createMutation<void, LeaveGroupParams>(groupService.leaveGroup);
