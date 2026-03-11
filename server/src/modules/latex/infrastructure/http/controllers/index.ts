import CreateLatexDocumentController from './CreateLatexDocumentController';
import DeleteLatexDocumentController from './DeleteLatexDocumentController';
import GetLatexDocumentController from './GetLatexDocumentController';
import ListLatexDocumentsController from './ListLatexDocumentsController';
import UpdateLatexDocumentController from './UpdateLatexDocumentController';
import UploadLatexAssetController from './UploadLatexAssetController';
import ListLatexAssetsController from './ListLatexAssetsController';
import DeleteLatexAssetController from './DeleteLatexAssetController';
import UpdateLatexAssetController from './UpdateLatexAssetController';
import ExportLatexDocumentTexController from './ExportLatexDocumentTexController';
import ExportLatexDocumentZipController from './ExportLatexDocumentZipController';
import ImportLatexDocumentController from './ImportLatexDocumentController';
import CompileLatexDocumentController from './CompileLatexDocumentController';
import ListLatexFilesController from './ListLatexFilesController';
import CreateLatexFileController from './CreateLatexFileController';
import UpdateLatexFileController from './UpdateLatexFileController';
import DeleteLatexFileController from './DeleteLatexFileController';
import SetLatexFileEntrypointController from './SetLatexFileEntrypointController';
import CreateLatexFolderController from './CreateLatexFolderController';
import ListLatexFoldersController from './ListLatexFoldersController';
import UpdateLatexFolderController from './UpdateLatexFolderController';
import DeleteLatexFolderController from './DeleteLatexFolderController';
import MoveLatexDocumentController from './MoveLatexDocumentController';
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
    updateAsset: UpdateLatexAssetController,
    exportDocumentTex: ExportLatexDocumentTexController,
    exportDocumentZip: ExportLatexDocumentZipController,
    importDocument: ImportLatexDocumentController,
    compileDocument: CompileLatexDocumentController,
    listFiles: ListLatexFilesController,
    createFile: CreateLatexFileController,
    updateFile: UpdateLatexFileController,
    deleteFile: DeleteLatexFileController,
    setFileEntrypoint: SetLatexFileEntrypointController,
    createFolder: CreateLatexFolderController,
    listFolders: ListLatexFoldersController,
    updateFolder: UpdateLatexFolderController,
    deleteFolder: DeleteLatexFolderController,
    moveDocument: MoveLatexDocumentController
});
