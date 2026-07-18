import { Resource } from '@core/constants/resources';
import { DeleteLatexFolderUseCase } from '@modules/latex/application/use-cases/DeleteLatexFolderUseCase';
import LatexController from '@modules/latex/infrastructure/http/controllers/LatexController';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(LatexController);

const folderHandlers = createCatalogFolderRouteHandlers({
    repository: container.resolve(LatexFolderRepository),
    folderLabel: 'LaTeX folder',
    deleteFolder: (input) => container.resolve(DeleteLatexFolderUseCase).execute(input)
});

export default createHttpModule({
    moduleKey: 'latex',
    basePath: '/api/latex/:teamId',
    resource: Resource.LATEX,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/documents', controller.listDocuments);
        router.post('/documents', controller.createDocument);
        router.post('/import', upload.single('file'), controller.importDocument);
        router.get('/documents/:documentId', controller.getDocument);
        router.delete('/documents/:documentId', controller.deleteDocument);
        router.patch('/documents/:documentId', controller.updateDocument);
        router.patch('/documents/:documentId/folder', controller.moveDocument);
        router.get('/documents/:documentId/assets', controller.listAssets);
        router.get('/documents/:documentId/assets/content', controller.getAssetContent);
        router.post('/documents/:documentId/assets', controller.uploadAsset);
        router.delete('/documents/:documentId/assets/:assetId', controller.deleteAsset);
        router.patch('/documents/:documentId/assets/:assetId', controller.updateAsset);
        router.get('/documents/:documentId/export/tex', controller.exportDocumentTex);
        router.get('/documents/:documentId/export/zip', controller.exportDocumentZip);
        router.post('/documents/:documentId/compile', controller.compileDocument);
        router.get('/documents/:documentId/files', controller.listFiles);
        router.post('/documents/:documentId/files', controller.createFile);
        router.patch('/documents/:documentId/files/:fileId', controller.updateFile);
        router.delete('/documents/:documentId/files/:fileId', controller.deleteFile);
        router.post('/documents/:documentId/files/:fileId/entrypoint', controller.setFileEntrypoint);
        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);
    }
});
