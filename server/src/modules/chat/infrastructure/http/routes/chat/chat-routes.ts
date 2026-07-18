import ChatController from '@modules/chat/infrastructure/http/controllers/ChatController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(ChatController);

export default createHttpModule({
    moduleKey: 'chat',
    basePath: '/api/chats',
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/', controller.getUserChats);
        router.post('/teams/:teamId/participants/:targetUserId', controller.getOrCreate);
        router.post('/groups', controller.createGroup);
        router.route('/:chatId/users')
            .post(controller.addUsersToGroup)
            .delete(controller.removeUsersFromGroup);
        router.patch('/:chatId', controller.updateGroupInfo);
        router.patch('/:chatId/admins', controller.updateGroupAdmins);
        router.delete('/:chatId/participants/self', controller.leaveGroup);
    }
});
