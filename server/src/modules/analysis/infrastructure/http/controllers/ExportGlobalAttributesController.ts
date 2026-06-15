import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportGlobalAttributesUseCase } from '@modules/analysis/application/use-cases/ExportGlobalAttributesUseCase';

export default createStreamController(ExportGlobalAttributesUseCase, {
    getHeaders: () => ({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="global-attributes.csv"`,
        'Cache-Control': 'no-store'
    }),
    extendParams: (req, params) => ({
        ...params,
        teamId: req.params.teamId,
        analysisId: req.params.analysisId,
        format: 'csv' as const
    })
});
