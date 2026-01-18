import AddUsersToGroupController from './AddUsersToGroupController';
import CreateGroupChatController from './CreateGroupChatController';
import GetOrCreateChatController from './GetOrCreateChatController';
import GetUserChatsController from './GetUserChatsController';
import LeaveGroupController from './LeaveGroupController';
import RemoveUsersFromGroupController from './RemoveUsersFromGroupController';
import UpdateGroupAdminsController from './UpdateGroupAdminsController';
import UpdateGroupInfoController from './UpdateGroupInfoController';
import { container } from 'tsyringe';

export default {
    addUsersToGroup: container.resolve(AddUsersToGroupController),
    createGroup: container.resolve(CreateGroupChatController),
    getOrCreate: container.resolve(GetOrCreateChatController),
    getUserChats: container.resolve(GetUserChatsController),
    leaveGroup: container.resolve(LeaveGroupController),
    removeUsersFromGroup: container.resolve(RemoveUsersFromGroupController),
    updateGroupAdmins: container.resolve(UpdateGroupAdminsController),
    updateGroupInfo: container.resolve(UpdateGroupInfoController)
};