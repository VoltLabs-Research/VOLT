import { Resource } from '@core/constants/resources';
import { DeleteLatexFolderUseCase } from '@modules/latex/application/use-cases/DeleteLatexFolderUseCase';
import latexControllers from '@modules/latex/infrastructure/http/controllers';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const folderHandlers = createCatalogFolderRouteHandlers({
    repository: container.resolve(LatexFolderRepository),
    folderLabel: 'LaTeX folder',
    deleteFolder: (input) => container.resolve(DeleteLatexFolderUseCase).execute(input)
});

export default createHttpModule({
    basePath: '/api/latex/:teamId',
    resource: Resource.LATEX,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/documents', latexControllers.listDocuments.handle);
        router.post('/documents', latexControllers.createDocument.handle);
        router.post('/import', upload.single('file'), latexControllers.importDocument.handle);
        router.get('/documents/:documentId', latexControllers.getDocument.handle);
        router.delete('/documents/:documentId', latexControllers.deleteDocument.handle);
        router.patch('/documents/:documentId', latexControllers.updateDocument.handle);
        router.patch('/documents/:documentId/folder', latexControllers.moveDocument.handle);
        router.get('/documents/:documentId/assets', latexControllers.listAssets.handle);
        router.get('/documents/:documentId/assets/content', latexControllers.getAssetContent.handle);
        router.post('/documents/:documentId/assets', latexControllers.uploadAsset.handle);
        router.delete('/documents/:documentId/assets/:assetId', latexControllers.deleteAsset.handle);
        router.patch('/documents/:documentId/assets/:assetId', latexControllers.updateAsset.handle);
        router.get('/documents/:documentId/export/tex', latexControllers.exportDocumentTex.handle);
        router.get('/documents/:documentId/export/zip', latexControllers.exportDocumentZip.handle);
        router.post('/documents/:documentId/compile', latexControllers.compileDocument.handle);
        router.get('/documents/:documentId/files', latexControllers.listFiles.handle);
        router.post('/documents/:documentId/files', latexControllers.createFile.handle);
        router.patch('/documents/:documentId/files/:fileId', latexControllers.updateFile.handle);
        router.delete('/documents/:documentId/files/:fileId', latexControllers.deleteFile.handle);
        router.post('/documents/:documentId/files/:fileId/entrypoint', latexControllers.setFileEntrypoint.handle);
        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);
    }
});
