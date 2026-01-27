import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router
};

router.use(protect);

router.get('/listing/:pluginSlug/:listingSlug', controllers.getPluginListingDocuments.handle);
router.get('/listing/:pluginSlug/:listingSlug/:trajectoryId', controllers.getPluginListingDocuments.handle);

export default module;
