import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetGlobalAttributesMetadataUseCase } from '@modules/analysis/application/use-cases/GetGlobalAttributesMetadataUseCase';

export default createController(GetGlobalAttributesMetadataUseCase, {
    extendParams: (req, params) => ({
        ...params,
        teamId: req.params.teamId,
        analysisId: req.params.analysisId
    })
});
