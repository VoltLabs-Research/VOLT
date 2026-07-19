import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { protect } from '@modules/auth/middlewares/authentication';
import SystemService from '@modules/system/services/SystemService';
import { systemRoutes } from '@volt/contracts/modules/system/routes';

export default class SystemController extends Controller {
    #service = new SystemService();

    @Route(systemRoutes.config)
    getConfig() {
        return this.#service.getConfig();
    }

    @Route(systemRoutes.rbac)
    @Middleware(protect)
    getRbac() {
        return this.#service.getRbac();
    }
}
