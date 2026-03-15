import { chatValidation } from '@modules/chat/infrastructure/http/validation/chat/chat-schemas';
import controllers from '@modules/chat/infrastructure/http/controllers/chat';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/chats',
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/', controllers.getUserChats.handle);
        router.post('/teams/:teamId/participants/:targetUserId', chatValidation.getOrCreate, controllers.getOrCreate.handle);
        router.post('/groups', chatValidation.createGroup, controllers.createGroup.handle);
        router.route('/:chatId/users')
            .post(chatValidation.addUsers, controllers.addUsersToGroup.handle)
            .delete(chatValidation.removeUsers, controllers.removeUsersFromGroup.handle);
        router.patch('/:chatId', chatValidation.updateGroupInfo, controllers.updateGroupInfo.handle);
        router.patch('/:chatId/admins', chatValidation.updateGroupAdmins, controllers.updateGroupAdmins.handle);
        router.delete('/:chatId/participants/self', chatValidation.leaveGroup, controllers.leaveGroup.handle);
    }
});
