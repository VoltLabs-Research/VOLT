import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import controllers from '@modules/chat/infrastructure/http/controllers/chat';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { chatValidation } from '@modules/chat/infrastructure/http/validation/chat-schemas';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/chats',
    router,
    teamScope: 'param'
};

const createGroupLimiter = createStandardRateLimiter(10);

const addUserLimiter = createStandardRateLimiter(20);

router.use(protect);

router.get('/', controllers.getUserChats.handle);
router.get('/teams/:teamId/users/:targetUserId', chatValidation.getOrCreate, controllers.getOrCreate.handle);
router.get('/teams/:teamId/participants/:targetUserId', chatValidation.getOrCreate, controllers.getOrCreate.handle);
router.post('/groups', createGroupLimiter, chatValidation.createGroup, controllers.createGroup.handle);

router.route('/:chatId/users')
    .post(addUserLimiter, chatValidation.addUsers, controllers.addUsersToGroup.handle)
    .delete(chatValidation.removeUsers, controllers.removeUsersFromGroup.handle);

router.post('/:chatId/groups/add-user', addUserLimiter, chatValidation.addUsers, controllers.addUsersToGroup.handle);
router.post('/:chatId/groups/remove-users', chatValidation.removeUsers, controllers.removeUsersFromGroup.handle);

router.patch('/:chatId/group', chatValidation.updateGroupInfo, controllers.updateGroupInfo.handle);
router.patch('/:chatId/groups/info', chatValidation.updateGroupInfo, controllers.updateGroupInfo.handle);

router.patch('/:chatId/group/admins', chatValidation.updateGroupAdmins, controllers.updateGroupAdmins.handle);
router.patch('/:chatId/groups/admins', chatValidation.updateGroupAdmins, controllers.updateGroupAdmins.handle);

router.delete('/:chatId/participants/self', chatValidation.leaveGroup, controllers.leaveGroup.handle);
router.patch('/:chatId/groups/leave', chatValidation.leaveGroup, controllers.leaveGroup.handle);

export default module;
