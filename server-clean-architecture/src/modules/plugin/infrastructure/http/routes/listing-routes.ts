import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers/listing';

const router = Router();

router.use(protect);

router.get('/:pluginId/listing-documents', controllers.getPluginListingDocuments.handle);

export default router;
