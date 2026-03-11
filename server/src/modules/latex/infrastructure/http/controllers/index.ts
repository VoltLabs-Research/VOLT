import CreateLatexDocumentController from './CreateLatexDocumentController';
import DeleteLatexDocumentController from './DeleteLatexDocumentController';
import GetLatexDocumentController from './GetLatexDocumentController';
import ListLatexDocumentsController from './ListLatexDocumentsController';
import UpdateLatexDocumentController from './UpdateLatexDocumentController';
import UploadLatexAssetController from './UploadLatexAssetController';
import ListLatexAssetsController from './ListLatexAssetsController';
import DeleteLatexAssetController from './DeleteLatexAssetController';
import ExportLatexDocumentTexController from './ExportLatexDocumentTexController';
import ExportLatexDocumentZipController from './ExportLatexDocumentZipController';
import ImportLatexDocumentController from './ImportLatexDocumentController';
import CompileLatexDocumentController from './CompileLatexDocumentController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    createDocument: CreateLatexDocumentController,
    deleteDocument: DeleteLatexDocumentController,
    getDocument: GetLatexDocumentController,
    listDocuments: ListLatexDocumentsController,
    updateDocument: UpdateLatexDocumentController,
    uploadAsset: UploadLatexAssetController,
    listAssets: ListLatexAssetsController,
    deleteAsset: DeleteLatexAssetController,
    exportDocumentTex: ExportLatexDocumentTexController,
    exportDocumentZip: ExportLatexDocumentZipController,
    importDocument: ImportLatexDocumentController,
    compileDocument: CompileLatexDocumentController
});
