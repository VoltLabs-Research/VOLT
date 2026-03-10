import controllers from '@modules/team-cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/team-cluster/infrastructure/http/validation/team-cluster-schemas';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/team-clusters/:teamClusterId',
    router
};

const lifecycleRateLimiter = createStandardRateLimiter(30, 'Too many team cluster lifecycle requests, please try again later');

router.post(
    '/healthcheck',
    lifecycleRateLimiter,
    teamClusterValidation.processHealthcheck,
    controllers.processHealthcheck.handle
);
router.post(
    '/install-manifest',
    lifecycleRateLimiter,
    teamClusterValidation.generateInstallManifest,
    controllers.generateInstallManifest.handle
);

export default module;
