/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import { Router } from 'express';
import * as authMiddleware from '@middlewares/authentication';
import NotificationController from '@controllers/notification';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware.protect);

router
    .route('/')
    .get(controller.getUserNotifications);

router
    .route('/:id')
    .patch(controller.markNotificationRead)
    .delete(controller.deleteNotification);

export default router;
