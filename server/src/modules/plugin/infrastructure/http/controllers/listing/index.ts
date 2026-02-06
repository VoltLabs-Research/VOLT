import GetPluginListingDocumentsController from './GetPluginListingDocumentsController';
import { container } from 'tsyringe';

export default {
    getPluginListingDocuments: container.resolve(GetPluginListingDocumentsController)
};