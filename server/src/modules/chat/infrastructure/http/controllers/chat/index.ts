import AddUsersToGroupController from './AddUsersToGroupController';
import CreateGroupChatController from './CreateGroupChatController';
import GetOrCreateChatController from './GetOrCreateChatController';
import GetUserChatsController from './GetUserChatsController';
import LeaveGroupController from './LeaveGroupController';
import RemoveUsersFromGroupController from './RemoveUsersFromGroupController';
import UpdateGroupAdminsController from './UpdateGroupAdminsController';
import UpdateGroupInfoController from './UpdateGroupInfoController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    addUsersToGroup: AddUsersToGroupController,
    createGroup: CreateGroupChatController,
    getOrCreate: GetOrCreateChatController,
    getUserChats: GetUserChatsController,
    leaveGroup: LeaveGroupController,
    removeUsersFromGroup: RemoveUsersFromGroupController,
    updateGroupAdmins: UpdateGroupAdminsController,
    updateGroupInfo: UpdateGroupInfoController
});