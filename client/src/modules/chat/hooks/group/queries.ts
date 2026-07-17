import { createMutation } from '@/shared/query';
import groupService from '../../api/services/group-service';
import type { Chat } from '../../api/types/chat';
import type {
    AddUsersToGroupInput,
    CreateGroupChat,
    RemoveUsersFromGroupInput,
    UpdateGroupAdminsInput,
    UpdateGroupInfoInput
} from '../../api/services/group-service';

interface LeaveGroupParams {
    chatId: string;
}

export const useCreateGroupMutation = createMutation<Chat, CreateGroupChat>(groupService.createGroup);
export const useAddUsersToGroupMutation = createMutation<Chat, AddUsersToGroupInput>(groupService.addUsersToGroup);
export const useRemoveUsersFromGroupMutation = createMutation<Chat, RemoveUsersFromGroupInput>(groupService.removeUsersFromGroup);
export const useUpdateGroupInfoMutation = createMutation<Chat, UpdateGroupInfoInput>(groupService.updateGroupInfo);
export const useUpdateGroupAdminsMutation = createMutation<Chat, UpdateGroupAdminsInput>(groupService.updateGroupAdmins);
export const useLeaveGroupMutation = createMutation<void, LeaveGroupParams>(groupService.leaveGroup);
