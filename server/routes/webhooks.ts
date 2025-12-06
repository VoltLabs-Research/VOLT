import { Router } from 'express';
import WebhooksController from '@/controllers/webhooks';
import * as middleware from '@/middlewares/authentication';

const router = Router();
const controller = new WebhooksController();

router.use(middleware.protect);

router.route('/')
    .get(controller.getMyWebhooks)
    .post(controller.createWebhook);

router.route('/stats')
    .get(controller.getWebhookStats);

router.route('/:id')
    .get(controller.getWebhook)
    .patch(controller.updateWebhook)
    .delete(controller.deleteWebhook);

router.route('/:id/test')
    .post(controller.testWebhook);

export default router;
