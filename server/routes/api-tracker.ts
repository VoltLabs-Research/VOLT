import { Router } from 'express';
import { protect } from '@/middlewares/authentication';
import ApiTrackerController from '@/controllers/api-tracker';

const router = Router();
const controller = new ApiTrackerController();

router.use(protect);

router.get('/', controller.getAll);

export default router;
