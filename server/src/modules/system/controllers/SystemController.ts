import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import systemService from '@modules/system/services/SystemService';
import { systemRoutes } from '@volt/contracts/modules/system/routes';

export default class SystemController extends Controller {
    @Route(systemRoutes.config)
    getConfig() {
        return systemService.getConfig();
    }

    @Route(systemRoutes.rbac)
    @Middleware(protect)
    getRbac() {
        return systemService.getRbac();
    }
}
