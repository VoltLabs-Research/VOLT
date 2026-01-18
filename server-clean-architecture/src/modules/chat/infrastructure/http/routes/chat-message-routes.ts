import { Router } from 'express';
import { upload } from '@/src/shared/infrastructure/http/middleware/upload';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { uploadToStorage } from '../middlewares/upload-to-storage';
import controllers from '../controllers/chat-messages';

const router = Router();

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

export default router;