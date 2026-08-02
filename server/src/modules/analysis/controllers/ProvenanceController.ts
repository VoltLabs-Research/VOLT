import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import { provenanceRoutes } from '@volt/contracts/modules/analysis/routes';

@Middleware(protect, teamScoped(Resource.ANALYSIS))
export default class ProvenanceController extends Controller {
    #service = new ProvenanceService();

    @Route(provenanceRoutes.query)
    async query(@Query() query: Record<string, string>){
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
        return { records };
    }

    @Route(provenanceRoutes.get)
    get(@Param('provenanceId') provenanceId: string){
        return this.#service.getRequired(provenanceId);
    }

    @Route(provenanceRoutes.reproduce)
    reproduce(@Param('provenanceId') provenanceId: string){
        return this.#service.getReproduction(provenanceId);
    }
}
