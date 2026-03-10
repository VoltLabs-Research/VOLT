import { chatValidation } from '@modules/chat/infrastructure/http/validation/chat/chat-schemas';
import controllers from '@modules/chat/infrastructure/http/controllers/chat';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/chats',
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/', controllers.getUserChats.handle);
        router.post('/teams/:teamId/participants/:targetUserId', chatValidation.getOrCreate, controllers.getOrCreate.handle);
        router.post('/groups', RATE_LIMIT_POLICIES.chatGroupCreate, chatValidation.createGroup, controllers.createGroup.handle);
        router.route('/:chatId/users')
            .post(RATE_LIMIT_POLICIES.chatGroupAddUsers, chatValidation.addUsers, controllers.addUsersToGroup.handle)
            .delete(chatValidation.removeUsers, controllers.removeUsersFromGroup.handle);
        router.patch('/:chatId', chatValidation.updateGroupInfo, controllers.updateGroupInfo.handle);
        router.patch('/:chatId/admins', chatValidation.updateGroupAdmins, controllers.updateGroupAdmins.handle);
        router.delete('/:chatId/participants/self', chatValidation.leaveGroup, controllers.leaveGroup.handle);
    }
});
