import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import { provenanceRoutes } from '@volt/contracts/modules/analysis/routes';
import type { Response } from 'express';

/**
 * The HTTP controller for analysis provenance (pollium style). Class-level
 * `@Middleware(protect, teamScoped(Resource.ANALYSIS))` matches the old
 * team-scoped `/api/provenance/:teamId` mount. The former inline handlers
 * replied with RAW JSON (no BaseResponse envelope) and used bespoke 404 bodies,
 * so each handler takes `@Res()` and writes the response itself, reproducing the
 * exact wire shape.
 */
@Middleware(protect, teamScoped(Resource.ANALYSIS))
export default class ProvenanceController extends Controller {
    #service = new ProvenanceService();

    @Route(provenanceRoutes.query)
    async query(@Query() query: Record<string, string>, @Res() res: Response): Promise<void> {
        const { pluginName, pluginVersion, trajectoryId, executedBy, from, to, limit, skip } = query;
        const records = await this.#service.queryProvenance({
            pluginName,
            pluginVersion,
            trajectoryId,
            executedBy,
            fromDate: from ? new Date(from) : undefined,
            toDate: to ? new Date(to) : undefined,
            limit: limit ? Number(limit) : undefined,
            skip: skip ? Number(skip) : undefined
        });
        res.json({ records });
    }

    @Route(provenanceRoutes.get)
    async get(@Param('provenanceId') provenanceId: string, @Res() res: Response): Promise<void> {
        const record = await this.#service.getProvenance(provenanceId);
        if (!record) {
            res.status(404).json({ error: 'Provenance record not found' });
            return;
        }
        res.json(record);
    }

    @Route(provenanceRoutes.reproduce)
    async reproduce(@Param('provenanceId') provenanceId: string, @Res() res: Response): Promise<void> {
        const record = await this.#service.getProvenance(provenanceId);
        if (!record) {
            res.status(404).json({ error: 'Provenance record not found' });
            return;
        }
        res.json({ command: record.reproductionCommand, provenanceId });
    }
}
