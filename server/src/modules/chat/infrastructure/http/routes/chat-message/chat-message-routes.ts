import { uploadToStorage } from '@modules/chat/infrastructure/http/middlewares/upload-to-storage';
import { chatMessageValidation } from '@modules/chat/infrastructure/http/validation/chat-message/chat-message-schemas';
import { uploadChatSingleFile } from '@shared/infrastructure/http/middleware/upload';
import controllers from '@modules/chat/infrastructure/http/controllers/chat-message';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/chat-messages',
    protected: true,
    routes: (router) => {
        router.get('/:chatId/messages', chatMessageValidation.getChatMessages, controllers.getChatMessages.handle);
        router.post(
            '/:chatId/messages',
            chatMessageValidation.sendMessage,
            controllers.sendChatMessage.handle
        );
        router.route('/:chatId/messages/:messageId')
            .patch(chatMessageValidation.editMessage, controllers.editMessage.handle)
            .delete(chatMessageValidation.deleteMessage, controllers.delete.handle);
        router.patch('/:chatId/messages/read', chatMessageValidation.markMessagesAsRead, controllers.markMessagesAsRead.handle);
        router.patch('/:chatId/messages/:messageId/reactions', chatMessageValidation.toggleReaction, controllers.toggleMessageReaction.handle);
        router.post(
            '/:chatId/messages/file',
            chatMessageValidation.sendFileMessage,
            uploadChatSingleFile('file'),
            uploadToStorage,
            controllers.sendFileMessage.handle
        );
    }
});
