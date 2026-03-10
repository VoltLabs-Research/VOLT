import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';

import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const GetPluginListingDocumentsController = createController(GetPluginListingDocumentsUseCase);
const GetListingRowsByAnalysisIdController = createController(GetListingRowsByAnalysisIdUseCase);
const GetSubListingController = createController(GetSubListingUseCase);
const ExportPluginListingDocumentsController = createStreamController(ExportPluginListingDocumentsUseCase, {
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});
const ExportListingRowsByAnalysisIdController = createStreamController(ExportListingRowsByAnalysisIdUseCase, {
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});

export default createControllerRegistry({
    getPluginListingDocuments: GetPluginListingDocumentsController,
    exportPluginListingDocuments: ExportPluginListingDocumentsController,
    getListingRowsByAnalysisId: GetListingRowsByAnalysisIdController,
    exportListingRowsByAnalysisId: ExportListingRowsByAnalysisIdController,
    getSubListing: GetSubListingController
});