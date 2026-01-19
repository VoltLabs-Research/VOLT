import { Router } from 'express';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { uploadToStorage } from '@modules/chat/infrastructure/http/middlewares/upload-to-storage';
import controllers from '@modules/chat/infrastructure/http/controllers/chat-messages';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/chat-messages',
    router
};

router.use(protect);

router.route('/:chatId/messages')
    .get(controllers.getChatMessages.handle)
    .post(controllers.sendChatMessage.handle);


router.route('/:chatId/messages/:messageId')
    .patch(controllers.editMessage.handle)
    .delete(controllers.delete.handle);

router.patch('/:chatId/read', controllers.markMessagesAsRead.handle);
router.post('/:chatId/messages/:messageId/reaction', controllers.toggleMessageReaction.handle);

router.post(
    '/:chatId/send-file',
    upload.single('file'),
    uploadToStorage,
    controllers.sendFileMessage.handle
);

router.get('/files/:filename', controllers.getFilePreview.handle);

router.post(
    '/:chatId/upload',
    upload.single('file'),
    uploadToStorage,
    controllers.uploadFile.handle
);

export default module;