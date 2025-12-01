import express from 'express';
import * as systemController from '@/controllers/system';
import { protect } from '@/middlewares/authentication';

const router = express.Router();

router.use(protect);

router.get('/stats', systemController.getSystemStats);

export default router;
