import controllers from '@modules/chat/infrastructure/http/controllers/chat';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/chats',
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/', controllers.getUserChats.handle);
        router.post('/teams/:teamId/participants/:targetUserId', controllers.getOrCreate.handle);
        router.post('/groups', controllers.createGroup.handle);
        router.route('/:chatId/users')
            .post(controllers.addUsersToGroup.handle)
            .delete(controllers.removeUsersFromGroup.handle);
        router.patch('/:chatId', controllers.updateGroupInfo.handle);
        router.patch('/:chatId/admins', controllers.updateGroupAdmins.handle);
        router.delete('/:chatId/participants/self', controllers.leaveGroup.handle);
    }
});
