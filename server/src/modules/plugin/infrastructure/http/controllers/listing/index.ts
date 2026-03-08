import { container } from 'tsyringe';
import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';

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

export default {
    getPluginListingDocuments: container.resolve(GetPluginListingDocumentsController),
    exportPluginListingDocuments: container.resolve(ExportPluginListingDocumentsController),
    getListingRowsByAnalysisId: container.resolve(GetListingRowsByAnalysisIdController),
    exportListingRowsByAnalysisId: container.resolve(ExportListingRowsByAnalysisIdController),
    getSubListing: container.resolve(GetSubListingController)
};
