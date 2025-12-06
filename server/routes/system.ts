import express from 'express';
import SystemController from '@/controllers/system';
import { protect } from '@/middlewares/authentication';

const router = express.Router();
const systemController = new SystemController();

router.use(protect);

router.get('/stats', systemController.getSystemStats);

export default router;
