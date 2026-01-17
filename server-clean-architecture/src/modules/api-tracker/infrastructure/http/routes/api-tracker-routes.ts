import { Router } from 'express';
import { container } from 'tsyringe';
import { ListApiTrackerController } from '../controllers/ListApiTrackerController';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';

const router = Router();

const listApiTrackerController = container.resolve(ListApiTrackerController);

router.get(
    '/',
    protect,
    (req, res, next) => listApiTrackerController.handle(req, res, next)
);

export default router;
