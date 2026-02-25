import GetPluginListingDocumentsController from './GetPluginListingDocumentsController';
import ExportPluginListingDocumentsController from './ExportPluginListingDocumentsController';
import GetListingRowsByAnalysisIdController from './GetListingRowsByAnalysisIdController';
import { container } from 'tsyringe';

export default {
    getPluginListingDocuments: container.resolve(GetPluginListingDocumentsController),
    exportPluginListingDocuments: container.resolve(ExportPluginListingDocumentsController),
    getListingRowsByAnalysisId: container.resolve(GetListingRowsByAnalysisIdController)
};