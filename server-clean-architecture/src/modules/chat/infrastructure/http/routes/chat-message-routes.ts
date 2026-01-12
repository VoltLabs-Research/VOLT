import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import DeleteMessageController from '../controllers/chat-messages/DeleteMessageController';
import EditMessageController from '../controllers/chat-messages/EditMessageController';
import GetChatMessagesController from '../controllers/chat-messages/GetChatMessagesController';
import MarkMessagesAsReadController from '../controllers/chat-messages/MarkMessagesAsReadController';
import SendChatMessageController from '../controllers/chat-messages/SendChatMessageController';
import ToggleMessageReactionController from '../controllers/chat-messages/ToggleMessageReactionController';

const deleteMessageController = container.resolve(DeleteMessageController);
const editMessageController = container.resolve(EditMessageController);
const getChatMessagesController = container.resolve(GetChatMessagesController);
const markMessageAsReadController = container.resolve(MarkMessagesAsReadController);
const sendChatMessageController = container.resolve(SendChatMessageController);
const toggleMessageReactionController = container.resolve(ToggleMessageReactionController);

const router = Router();

router.use(protect);

router.route('/:chatId/messages')
    .get(getChatMessagesController.handle)
    .post(sendChatMessageController.handle);


router.route('/:chatId/messages/:messageId')
    .patch(editMessageController.handle)
    .delete(deleteMessageController.handle);

router.patch('/:chatId/read', markMessageAsReadController.handle);
router.post('/:chatId/messages/:messageId/reaction', toggleMessageReactionController.handle);

// router.post('/:chatId/send-file', sendFileMessageController.handle);
// router.get('/files/:filename', getFilePreviewController.handle);

export default router;