import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Req, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import LatexDocumentService from '@modules/latex/services/LatexDocumentService';
import LatexDownloadService from '@modules/latex/services/LatexDownloadService';
import LatexFileService from '@modules/latex/services/LatexFileService';
import { latexRoutes } from '@volt/contracts/modules/latex/routes';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import LatexAssetService from '@modules/latex/services/LatexAssetService';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { pipeStreamToResponse } from '@shared/infrastructure/http/responses/pipe-stream';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type {
    LatexDocumentQuery,
    LatexFolderQuery
} from '@modules/latex/contracts/queries';
import type {
    CreateLatexDocumentInput,
    UpdateLatexDocumentInput,
    MoveLatexDocumentInput,
    CreateLatexFileInput,
    UpdateLatexFileInput,
    UpdateLatexAssetInput,
    UploadLatexAssetInput,
    CreateLatexFolderInput,
    UpdateLatexFolderInput
} from '@volt/contracts/modules/latex/http';

@Middleware(protect, teamScoped(Resource.LATEX))
export default class LatexController extends Controller {
    #documents = new LatexDocumentService();
    #files = new LatexFileService();
    #downloads = new LatexDownloadService();
    #assets = new LatexAssetService();
    #folders = new CatalogFolderService(CatalogFolderKind.Latex);

    @Route(latexRoutes.listDocuments)
    listDocuments(
        @Param('teamId') teamId: string,
        @Query() query: LatexDocumentQuery
    ){
        return this.#documents.listDocuments({
            teamId,
            ...query
        });
    }

    @Route(latexRoutes.createDocument)
    @Status(201)
    createDocument(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateLatexDocumentInput
    ){
        return this.#documents.createDocument({
            teamId,
            userId,
            ...body
        });
    }

    @Route(latexRoutes.importDocument)
    @Status(201)
    @Middleware(upload.single('file'))
    importDocument(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest
    ){
        const body = (req.body ?? {}) as { folderId?: string | null };
        return this.#documents.importDocument({
            teamId,
            userId,
            file: req.file as Express.Multer.File,
            folderId: body.folderId ?? null
        });
    }

    @Route(latexRoutes.getDocument)
    getDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string
    ){
        return this.#documents.getDocument({
            teamId,
            documentId
        });
    }

    @Route(latexRoutes.deleteDocument)
    async deleteDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string
    ){
        await this.#documents.deleteDocument({
            teamId,
            documentId,
            userId
        });
    }

    @Route(latexRoutes.updateDocument)
    updateDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: UpdateLatexDocumentInput
    ) {
        return this.#documents.updateDocument({
            teamId,
            documentId,
            userId,
            ...body
        });
    }

    @Route(latexRoutes.moveDocument)
    @Status(200)
    moveDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Body() body: MoveLatexDocumentInput
    ){
        return this.#documents.moveDocument({
            teamId,
            documentId,
            folderId: body.folderId
        });
    }

    @Route(latexRoutes.listAssets)
    listAssets(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string
    ){
        return this.#assets.listAssets({
            teamId,
            documentId
        });
    }

    @Route(latexRoutes.getAssetContent)
    async getAssetContent(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Query('key') key: string,
        @Res() res: Response
    ): Promise<void> {
        await this.#sendDownload(res, await this.#assets.getAssetContent({
            teamId,
            documentId,
            key
        }));
    }

    @Route(latexRoutes.uploadAsset)
    @Status(201)
    uploadAsset(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: UploadLatexAssetInput
    ) {
        return this.#assets.uploadAsset({
            teamId,
            documentId,
            userId,
            ...body
        });
    }

    @Route(latexRoutes.deleteAsset)
    async deleteAsset(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('assetId') assetId: string
    ){
        await this.#assets.deleteAsset({
            teamId,
            documentId,
            assetId
        });
    }

    @Route(latexRoutes.updateAsset)
    updateAsset(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('assetId') assetId: string,
        @Body() body: UpdateLatexAssetInput
    ) {
        return this.#assets.updateAsset({
            teamId,
            documentId,
            assetId,
            path: body.path
        });
    }

    @Route(latexRoutes.exportDocumentTex)
    async exportDocumentTex(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Res() res: Response
    ): Promise<void>{
        await this.#sendDownload(res, await this.#downloads.exportDocumentTex({
            teamId,
            documentId
        }));
    }

    @Route(latexRoutes.exportDocumentZip)
    async exportDocumentZip(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Res() res: Response
    ): Promise<void>{
        await this.#sendDownload(res, await this.#downloads.exportDocumentZip({
            teamId,
            documentId
        }));
    }

    @Route(latexRoutes.compileDocument)
    async compileDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Res() res: Response
    ): Promise<void>{
        await this.#sendDownload(res, await this.#downloads.compileDocument({
            teamId,
            documentId
        }));
    }

    @Route(latexRoutes.listFiles)
    listFiles(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string
    ){
        return this.#files.listFiles({
            teamId,
            documentId
        });
    }

    @Route(latexRoutes.createFile)
    @Status(201)
    createFile(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateLatexFileInput
    ) {
        return this.#files.createFile({
            teamId,
            documentId,
            userId,
            ...body
        });
    }

    @Route(latexRoutes.updateFile)
    updateFile(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('fileId') fileId: string,
        @Body() body: UpdateLatexFileInput
    ) {
        return this.#files.updateFile({
            teamId,
            documentId,
            fileId,
            ...body
        });
    }

    @Route(latexRoutes.deleteFile)
    async deleteFile(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('fileId') fileId: string
    ){
        await this.#files.deleteFile({
            teamId,
            documentId,
            fileId
        });
    }

    @Route(latexRoutes.setFileEntrypoint)
    setFileEntrypoint(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('fileId') fileId: string
    ){
        return this.#files.setFileEntrypoint({
            teamId,
            documentId,
            fileId
        });
    }

    @Route(latexRoutes.listFolders)
    listFolders(
        @Param('teamId') teamId: string,
        @Query() query: LatexFolderQuery
    ){
        return this.#folders.list(teamId, query);
    }

    @Route(latexRoutes.getFolder)
    getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        return this.#folders.get(teamId, folderId, 'LaTeX folder not found');
    }

    @Route(latexRoutes.createFolder)
    @Status(201)
    createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateLatexFolderInput
    ){
        return this.#folders.create(teamId, userId, body);
    }

    @Route(latexRoutes.updateFolder)
    updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body() body: UpdateLatexFolderInput
    ){
        return this.#folders.update(teamId, folderId, body.title);
    }

    @Route(latexRoutes.removeFolder)
    async removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        await this.#documents.deleteFolder({
            teamId,
            folderId
        });
    }

    async #sendDownload(res: Response, output: DownloadStreamOutput): Promise<void>{
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

}
