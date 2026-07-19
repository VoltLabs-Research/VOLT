import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/middlewares/team-scoped';
import { protect } from '@modules/auth/middlewares/authentication';
import { Resource } from '@core/constants/resources';
import {
    ProvenanceNotFoundError,
    ProvenanceService
} from '@modules/analysis/services/ProvenanceService';
import { provenanceRoutes } from '@volt/contracts/modules/analysis/routes';
import type { Response } from 'express';

const sendServiceResult = async <T>(res: Response, operation: () => Promise<T>): Promise<void> => {
    try {
        res.json(await operation());
    } catch (error) {
        if (error instanceof ProvenanceNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        throw error;
    }
};

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
        await sendServiceResult(res, () => this.#service.getRequired(provenanceId));
    }

    @Route(provenanceRoutes.reproduce)
    async reproduce(@Param('provenanceId') provenanceId: string, @Res() res: Response): Promise<void> {
        await sendServiceResult(res, () => this.#service.getReproduction(provenanceId));
    }
}
