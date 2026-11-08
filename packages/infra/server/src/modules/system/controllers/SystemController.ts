import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { CurrentUser } from '@shared/http/params';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import systemService from '@modules/system/services/SystemService';
import systemUpdateService from '@modules/system/services/SystemUpdateService';
import { systemRoutes } from '@volt/contracts/modules/system/routes';
import type User from '@modules/auth/models/User';

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

    @Route(systemRoutes.update)
    @Middleware(protect)
    getUpdate(@CurrentUser() user: User) {
        return systemUpdateService.status(user.id);
    }

    @Route(systemRoutes.applyUpdate)
    @Middleware(protect)
    applyUpdate(@CurrentUser() user: User) {
        return systemUpdateService.apply(user.id);
    }
}
