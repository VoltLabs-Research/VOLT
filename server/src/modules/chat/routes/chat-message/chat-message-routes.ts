import ChatController from '@modules/chat/controllers/ChatController';
import { uploadToStorage } from '@modules/chat/middlewares/upload-to-storage';
import { uploadChatSingleFile } from '@shared/infrastructure/http/middleware/upload';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(ChatController);

export default createHttpModule({
    moduleKey: 'chat',
    basePath: '/api/chat-messages',
    protected: true,
    routes: (router) => {
        router.get('/:chatId/messages', controller.getChatMessages);
        router.post(
            '/:chatId/messages',
            controller.sendChatMessage
        );
        router.route('/:chatId/messages/:messageId')
            .patch(controller.editMessage)
            .delete(controller.deleteMessage);
        router.patch('/:chatId/messages/read', controller.markMessagesAsRead);
        router.patch('/:chatId/messages/:messageId/reactions', controller.toggleMessageReaction);
        router.post(
            '/:chatId/messages/file',
            uploadChatSingleFile('file'),
            uploadToStorage,
            controller.sendFileMessage
        );
    }
});
