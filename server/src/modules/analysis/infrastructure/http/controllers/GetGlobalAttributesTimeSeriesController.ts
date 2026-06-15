import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetGlobalAttributesTimeSeriesUseCase } from '@modules/analysis/application/use-cases/GetGlobalAttributesTimeSeriesUseCase';

export default createController(GetGlobalAttributesTimeSeriesUseCase, {
    extendParams: (req, params) => ({
        ...params,
        teamId: req.params.teamId,
        analysisId: req.params.analysisId,
        attribute: req.query.attribute as string,
        frameStart: req.query.frameStart !== undefined ? Number(req.query.frameStart) : undefined,
        frameEnd: req.query.frameEnd !== undefined ? Number(req.query.frameEnd) : undefined
    })
});
