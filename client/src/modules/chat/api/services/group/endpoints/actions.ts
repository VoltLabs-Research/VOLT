import { post, patch, del } from '@/app/core/http/utilities/create-service';
import type { Chat } from '../../../entities/chat';
import type {
    AddUsersToGroupInputDTO,
    CreateGroupChatDTO,
    RemoveUsersFromGroupInputDTO,
    UpdateGroupAdminsInputDTO,
    UpdateGroupInfoInputDTO
} from '../../../dtos/group';

interface LeaveGroupParams {
    chatId: string;
};

const endpoints = {
    createGroup: post<CreateGroupChatDTO, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupInputDTO, Chat>('/:chatId/users'),
    removeUsersFromGroup: del<RemoveUsersFromGroupInputDTO, Chat>('/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInputDTO, Chat>('/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInputDTO, Chat>('/:chatId/admins'),
    leaveGroup: del<LeaveGroupParams, void>('/:chatId/participants/self', { unwrap: 'void' })
};

export default endpoints;
