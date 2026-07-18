import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import SystemService from '@modules/system/services/SystemService';
import { systemRoutes } from '@volt/contracts/modules/system/routes';

/**
 * The single HTTP controller for the system module (pollium style): each route
 * is bound with `@Route(systemRoutes.x)` and delegates to a {@link SystemService}
 * the controller `new`s itself. Unlike most controllers there is NO class-level
 * `@Middleware` because the two endpoints have different auth: `getConfig` is
 * PUBLIC (the client reads deployment mode + enabled modules before signing in,
 * matching the old `SystemConfigHttpModule` with `protected: false`), while
 * `getRbac` carries a method-level `@Middleware(protect)` (matching the old
 * protected `SystemHttpModule`). This single controller replaces both old
 * `createHttpModule` route files.
 */
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
