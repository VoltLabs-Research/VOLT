import { Router } from 'express';
import * as controllers from '@/controllers/plugins';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();

// router.use(authMiddleware.protect);

router.get('/manifests', controllers.getManifests);

export default router;