import GetPluginListingDocumentsController from './GetPluginListingDocumentsController';
import ExportPluginListingDocumentsController from './ExportPluginListingDocumentsController';
import { container } from 'tsyringe';

export default {
    getPluginListingDocuments: container.resolve(GetPluginListingDocumentsController),
    exportPluginListingDocuments: container.resolve(ExportPluginListingDocumentsController)
};