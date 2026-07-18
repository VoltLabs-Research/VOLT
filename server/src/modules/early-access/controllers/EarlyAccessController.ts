import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param } from '@shared/http/params';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import EarlyAccessService from '@modules/early-access/services/EarlyAccessService';
import { earlyAccessRoutes } from '@volt/contracts/modules/early-access/routes';
import type { CreateEarlyAccessSubscriptionInput } from '@volt/contracts/modules/early-access/http';

/**
 * The single HTTP controller for the early-access module (pollium style). The
 * endpoint is public (no `protect`, no team scope) — the previous
 * `createHttpModule({ protected: false })` — so the only middleware is the
 * per-route rate limiter, applied with a method-level `@Middleware`.
 */
export default class EarlyAccessController extends Controller {
    #service = new EarlyAccessService();

    @Route(earlyAccessRoutes.createSubscription)
    @Status(201)
    @Middleware(RATE_LIMIT_POLICIES.earlyAccessPublic)
    createSubscription(@Param('teamId') teamId: string, @Body() body: CreateEarlyAccessSubscriptionInput) {
        return this.#service.createSubscription(teamId, body);
    }
}
