import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetPluginListingDocumentsController from '../controllers/listing/GetPluginListingDocumentsController';

const getPluginListingDocumentsController = container.resolve(GetPluginListingDocumentsController);

const router = Router();

router.use(protect);

router.get('/:pluginId/listing-documents', getPluginListingDocumentsController.handle);

export default router;
