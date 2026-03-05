import GetPluginListingDocumentsController from './GetPluginListingDocumentsController';
import ExportPluginListingDocumentsController from './ExportPluginListingDocumentsController';
import GetListingRowsByAnalysisIdController from './GetListingRowsByAnalysisIdController';
import ExportListingRowsByAnalysisIdController from './ExportListingRowsByAnalysisIdController';
import GetSubListingController from './GetSubListingController';
import { container } from 'tsyringe';

export default {
    getPluginListingDocuments: container.resolve(GetPluginListingDocumentsController),
    exportPluginListingDocuments: container.resolve(ExportPluginListingDocumentsController),
    getListingRowsByAnalysisId: container.resolve(GetListingRowsByAnalysisIdController),
    exportListingRowsByAnalysisId: container.resolve(ExportListingRowsByAnalysisIdController),
    getSubListing: container.resolve(GetSubListingController)
};
