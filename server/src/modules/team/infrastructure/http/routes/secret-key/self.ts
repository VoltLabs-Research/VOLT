import controllers from '@modules/team/infrastructure/http/controllers/secret-key';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/secret-keys',
    router
};

router.use(protect);

router.get('/me', controllers.current.handle);

export default module;
