import { Router } from 'express';
import * as authMiddleware from '@middlewares/authentication';
import NotificationController from '@controllers/notification';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware.protect);

router
    .route('/')
    .get(controller.getAll);

router.patch('/read-all', controller.markAllRead);

router
    .route('/:id')
    .patch(controller.updateOne)
    .delete(controller.deleteOne);

export default router;
