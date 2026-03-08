import { post, patch } from '@/app/core/http/utilities/create-service';
import type { Chat } from '../../../entities/chat';
import type { CreateGroupChatDTO } from '../../../dtos/create-group-chat';
import type { AddUsersToGroupInputDTO } from '../../../dtos/add-users-to-group';
import type { RemoveUsersFromGroupInputDTO } from '../../../dtos/remove-users-from-group';
import type { UpdateGroupInfoInputDTO } from '../../../dtos/update-group-info';
import type { UpdateGroupAdminsInputDTO } from '../../../dtos/update-group-admins';

const endpoints = {
    createGroup: post<CreateGroupChatDTO, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupInputDTO, Chat>('/:chatId/groups/add-user'),
    removeUsersFromGroup: post<RemoveUsersFromGroupInputDTO, Chat>('/:chatId/groups/remove-users'),
    updateGroupInfo: patch<UpdateGroupInfoInputDTO, Chat>('/:chatId/groups/info'),
    updateGroupAdmins: patch<UpdateGroupAdminsInputDTO, Chat>('/:chatId/groups/admins'),
    leaveGroup: patch<{ chatId: string }, void>('/:chatId/groups/leave', { unwrap: 'void' })
};

export default endpoints;
