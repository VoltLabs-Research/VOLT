import { Router } from 'express';
import controllers from '../controllers/chat';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/chats',
    router
};

router.use(protect);

router.get('/', controllers.getUserChats.handle);
router.get('/teams/:teamId/participants/:targetUserId', controllers.getOrCreate.handle),
router.post('/groups', controllers.createGroup.handle);
router.post('/:chatId/groups/add-user', controllers.addUsersToGroup.handle);
router.post('/:chatId/groups/remove-users', controllers.removeUsersFromGroup.handle);
router.patch('/:chatId/groups/info', controllers.updateGroupInfo.handle);
router.patch('/:chatId/groups/admins', controllers.updateGroupAdmins.handle);
router.patch('/:chatId/groups/leave', controllers.leaveGroup.handle);

export default module;