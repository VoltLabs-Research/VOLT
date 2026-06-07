import { uploadToStorage } from '@modules/chat/infrastructure/http/middlewares/upload-to-storage';
import { uploadChatSingleFile } from '@shared/infrastructure/http/middleware/upload';
import controllers from '@modules/chat/infrastructure/http/controllers/chat-message';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/chat-messages',
    protected: true,
    routes: (router) => {
        router.get('/:chatId/messages', controllers.getChatMessages.handle);
        router.post(
            '/:chatId/messages',
            controllers.sendChatMessage.handle
        );
        router.route('/:chatId/messages/:messageId')
            .patch(controllers.editMessage.handle)
            .delete(controllers.delete.handle);
        router.patch('/:chatId/messages/read', controllers.markMessagesAsRead.handle);
        router.patch('/:chatId/messages/:messageId/reactions', controllers.toggleMessageReaction.handle);
        router.post(
            '/:chatId/messages/file',
            uploadChatSingleFile('file'),
            uploadToStorage,
            controllers.sendFileMessage.handle
        );
    }
});
