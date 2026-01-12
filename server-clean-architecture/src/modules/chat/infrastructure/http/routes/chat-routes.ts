import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import AddUsersToGroupController from '../controllers/chat/AddUsersToGroupController';
import CreateGroupChatController from '../controllers/chat/CreateGroupChatController';
import GetOrCreateChatController from '../controllers/chat/GetOrCreateChatController';
import GetUserChatsController from '../controllers/chat/GetUserChatsController';
import LeaveGroupController from '../controllers/chat/LeaveGroupController';
import RemoveUsersFromGroupController from '../controllers/chat/RemoveUsersFromGroupController';
import UpdateGroupAdminsController from '../controllers/chat/UpdateGroupAdminsController';
import UpdateGroupInfoController from '../controllers/chat/UpdateGroupInfoController';

const addUsersToGroupController = container.resolve(AddUsersToGroupController);
const createGroupChatController = container.resolve(CreateGroupChatController);
const getOrCreateChatController = container.resolve(GetOrCreateChatController);
const getUserChatsController = container.resolve(GetUserChatsController);
const leaveGroupController = container.resolve(LeaveGroupController);
const removeUsersFromGroupController = container.resolve(RemoveUsersFromGroupController);
const updateGroupAdminsController = container.resolve(UpdateGroupAdminsController);
const updateGroupInfoController = container.resolve(UpdateGroupInfoController);

const router = Router();

router.use(protect);

router.get('/', getUserChatsController.handle);
router.get('/teams/:teamId/participants/:targetUserId', getOrCreateChatController.handle),
router.post('/groups', createGroupChatController.handle);
router.post('/:chatId/groups/add-user', addUsersToGroupController.handle);
router.post('/:chatId/groups/remove-users', removeUsersFromGroupController.handle);
router.patch('/:chatId/groups/info', updateGroupInfoController.handle);
router.patch('/:chatId/groups/admins', updateGroupAdminsController.handle);
router.patch('/:chatId/groups/leave', leaveGroupController.handle);

export default router;