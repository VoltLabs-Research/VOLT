import { Router } from 'express';
import { uploadToStorage } from '@modules/chat/infrastructure/http/middlewares/upload-to-storage';
import { chatMessageValidation } from '@modules/chat/infrastructure/http/validation/chat-message/chat-message-schemas';
import { createBurstRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { uploadChatSingleFile } from '@shared/infrastructure/http/middleware/upload';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/chat/infrastructure/http/controllers/chat-message';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/chat-messages',
    router
};

const sendMessageLimiter = createBurstRateLimiter(30, 60 * 1000);

const sendFileLimiter = createBurstRateLimiter(5, 60 * 1000);

router.use(protect);

router.get('/:chatId/messages', chatMessageValidation.getChatMessages, controllers.getChatMessages.handle);
router.post('/:chatId/messages', sendMessageLimiter, chatMessageValidation.sendMessage, controllers.sendChatMessage.handle);

router.route('/:chatId/messages/:messageId')
    .patch(chatMessageValidation.editMessage, controllers.editMessage.handle)
    .delete(chatMessageValidation.deleteMessage, controllers.delete.handle);

router.patch('/:chatId/messages/read', chatMessageValidation.markMessagesAsRead, controllers.markMessagesAsRead.handle);

router.patch('/:chatId/messages/:messageId/reactions', chatMessageValidation.toggleReaction, controllers.toggleMessageReaction.handle);

router.post(
    '/:chatId/messages/file',
    sendFileLimiter,
    chatMessageValidation.sendFileMessage,
    uploadChatSingleFile('file'),
    uploadToStorage,
    controllers.sendFileMessage.handle
);

export default module;
