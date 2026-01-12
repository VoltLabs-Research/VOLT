import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetNotificationsByUserIdController from '../controllers/GetNotificationsByUserIdController';
import MarkAllUserNotificationsAsReadController from '../controllers/MarkAllUserNotificationsAsReadController';

const getNotificationsByUserIdController = container.resolve(GetNotificationsByUserIdController);
const markAllUserNotificationsAsReadController = container.resolve(MarkAllUserNotificationsAsReadController);

const router = Router();

router.use(protect);

router.get('/', getNotificationsByUserIdController.handle);
router.patch('/read-all', markAllUserNotificationsAsReadController.handle);

export default router;