import { Resource } from '@core/constants/resources';
import latexControllers from '@modules/latex/infrastructure/http/controllers';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/latex/:teamId',
    resource: Resource.LATEX,
    routes: (router) => {
        router.get('/documents', latexControllers.listDocuments.handle);
        router.post('/documents', latexControllers.createDocument.handle);
        router.post('/import', upload.single('file'), latexControllers.importDocument.handle);
        router.get('/documents/:documentId', latexControllers.getDocument.handle);
        router.delete('/documents/:documentId', latexControllers.deleteDocument.handle);
        router.patch('/documents/:documentId', latexControllers.updateDocument.handle);
        router.get('/documents/:documentId/assets', latexControllers.listAssets.handle);
        router.post('/documents/:documentId/assets', upload.single('file'), latexControllers.uploadAsset.handle);
        router.delete('/documents/:documentId/assets/:assetId', latexControllers.deleteAsset.handle);
        router.get('/documents/:documentId/export/tex', latexControllers.exportDocumentTex.handle);
        router.get('/documents/:documentId/export/zip', latexControllers.exportDocumentZip.handle);
        router.post('/documents/:documentId/compile', latexControllers.compileDocument.handle);
    }
});
