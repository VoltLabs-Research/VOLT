import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { container } from 'tsyringe';
import { ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

export default createHttpModule({
    moduleKey: 'analysis',
    basePath: '/api/provenance/:teamId',
    resource: Resource.ANALYSIS,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/query', async (req: AuthenticatedRequest, res: Response) => {
            const service = container.resolve(ProvenanceService);
            const { pluginName, pluginVersion, trajectoryId, executedBy, from, to, limit, skip } = req.query as Record<string, string>;
            const records = await service.queryProvenance({
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
        });

        router.get('/:provenanceId', async (req: AuthenticatedRequest, res: Response) => {
            const service = container.resolve(ProvenanceService);
            const record = await service.getProvenance(req.params.provenanceId as string);
            if (!record) {
                res.status(404).json({ error: 'Provenance record not found' });
                return;
            }
            res.json(record);
        });

        router.post('/:provenanceId/reproduce', async (req: AuthenticatedRequest, res: Response) => {
            const service = container.resolve(ProvenanceService);
            const record = await service.getProvenance(req.params.provenanceId as string);
            if (!record) {
                res.status(404).json({ error: 'Provenance record not found' });
                return;
            }
            res.json({ command: record.reproductionCommand, provenanceId: req.params.provenanceId });
        });
    }
});
