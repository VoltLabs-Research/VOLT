import { Router } from 'express';
import pluginRoutes from './plugin-routes';
import exposureRoutes from './exposure-routes';
import listingRoutes from './listing-routes';

const router = Router();

router.use('/', pluginRoutes);
router.use('/', exposureRoutes);
router.use('/', listingRoutes);

export default router;