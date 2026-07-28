import { createMutation } from '@/shared/query';
import groupService from '../../api/services/group-service';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatScopedParams } from '@/modules/chat/contracts/api-params';
import type { AddUsersToGroupParams, CreateGroupChatParams, RemoveUsersFromGroupParams, UpdateGroupAdminsParams, UpdateGroupInfoParams } from '../../api/services/group-service';

export const useCreateGroupMutation = createMutation<Chat, CreateGroupChatParams>(groupService.createGroup);
export const useAddUsersToGroupMutation = createMutation<Chat, AddUsersToGroupParams>(groupService.addUsersToGroup);
export const useRemoveUsersFromGroupMutation = createMutation<Chat, RemoveUsersFromGroupParams>(groupService.removeUsersFromGroup);
export const useUpdateGroupInfoMutation = createMutation<Chat, UpdateGroupInfoParams>(groupService.updateGroupInfo);
export const useUpdateGroupAdminsMutation = createMutation<Chat, UpdateGroupAdminsParams>(groupService.updateGroupAdmins);
export const useLeaveGroupMutation = createMutation<void, ChatScopedParams>(groupService.leaveGroup);
