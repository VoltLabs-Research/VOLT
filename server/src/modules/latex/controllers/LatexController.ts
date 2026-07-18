import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Req, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import LatexService from '@modules/latex/services/LatexService';
import { latexRoutes } from '@volt/contracts/modules/latex/routes';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import type { Readable } from 'node:stream';
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
    #service = new LatexService();

    

    @Route(latexRoutes.listDocuments)
    listDocuments(@Param('teamId') teamId: string, @Query() query: Record<string, string>) {
        return this.#service.listDocuments({ teamId, ...query });
    }

    @Route(latexRoutes.createDocument)
    @Status(201)
    createDocument(@Param('teamId') teamId: string, @CurrentUser() userId: string, @Body() body: CreateLatexDocumentInput) {
        return this.#service.createDocument({ teamId, userId, ...body });
    }

    @Route(latexRoutes.importDocument)
    @Status(201)
    @Middleware(upload.single('file'))
    importDocument(@Param('teamId') teamId: string, @CurrentUser() userId: string, @Req() req: AuthenticatedRequest) {
        const body = (req.body ?? {}) as { folderId?: string | null };
        return this.#service.importDocument({
            teamId,
            userId,
            file: req.file as Express.Multer.File,
            folderId: body.folderId ?? null
        });
    }

    @Route(latexRoutes.getDocument)
    getDocument(@Param('teamId') teamId: string, @Param('documentId') documentId: string) {
        return this.#service.getDocument({ teamId, documentId });
    }

    @Route(latexRoutes.deleteDocument)
    async deleteDocument(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @CurrentUser() userId: string) {
        await this.#service.deleteDocument({ teamId, documentId, userId });
    }

    @Route(latexRoutes.updateDocument)
    updateDocument(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: UpdateLatexDocumentInput
    ) {
        return this.#service.updateDocument({ teamId, documentId, userId, ...body });
    }

    @Route(latexRoutes.moveDocument)
    @Status(200)
    moveDocument(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Body() body: MoveLatexDocumentInput) {
        return this.#service.moveDocument({ teamId, documentId, folderId: body.folderId });
    }

    

    @Route(latexRoutes.listAssets)
    listAssets(@Param('teamId') teamId: string, @Param('documentId') documentId: string) {
        return this.#service.listAssets({ teamId, documentId });
    }

    @Route(latexRoutes.getAssetContent)
    async getAssetContent(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Query('key') key: string,
        @Res() res: Response
    ): Promise<void> {
        const output = await this.#service.getAssetContent({ teamId, documentId, key });

        const headers: Record<string, string> = {
            'Content-Type': output.contentType || 'application/octet-stream',
            'Cache-Control': 'private, max-age=300'
        };
        if (typeof output.contentLength === 'number') {
            headers['Content-Length'] = String(output.contentLength);
        }
        if (output.contentEncoding) {
            headers['Content-Encoding'] = output.contentEncoding;
        }

        await this.#pipeStream(res, output.stream, headers);
    }

    @Route(latexRoutes.uploadAsset)
    @Status(201)
    uploadAsset(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: UploadLatexAssetInput
    ) {
        return this.#service.uploadAsset({ teamId, documentId, userId, ...body });
    }

    @Route(latexRoutes.deleteAsset)
    async deleteAsset(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Param('assetId') assetId: string) {
        await this.#service.deleteAsset({ teamId, documentId, assetId });
    }

    @Route(latexRoutes.updateAsset)
    updateAsset(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('assetId') assetId: string,
        @Body() body: UpdateLatexAssetInput
    ) {
        return this.#service.updateAsset({ teamId, documentId, assetId, path: body.path });
    }

    

    @Route(latexRoutes.exportDocumentTex)
    async exportDocumentTex(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Res() res: Response): Promise<void> {
        const output = await this.#service.exportDocumentTex({ teamId, documentId });
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(latexRoutes.exportDocumentZip)
    async exportDocumentZip(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Res() res: Response): Promise<void> {
        const output = await this.#service.exportDocumentZip({ teamId, documentId });
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(latexRoutes.compileDocument)
    async compileDocument(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Res() res: Response): Promise<void> {
        const output = await this.#service.compileDocument({ teamId, documentId });
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    

    @Route(latexRoutes.listFiles)
    listFiles(@Param('teamId') teamId: string, @Param('documentId') documentId: string) {
        return this.#service.listFiles({ teamId, documentId });
    }

    @Route(latexRoutes.createFile)
    @Status(201)
    createFile(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateLatexFileInput
    ) {
        return this.#service.createFile({ teamId, documentId, userId, ...body });
    }

    @Route(latexRoutes.updateFile)
    updateFile(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @Param('fileId') fileId: string,
        @Body() body: UpdateLatexFileInput
    ) {
        return this.#service.updateFile({ teamId, documentId, fileId, ...body });
    }

    @Route(latexRoutes.deleteFile)
    async deleteFile(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Param('fileId') fileId: string) {
        await this.#service.deleteFile({ teamId, documentId, fileId });
    }

    @Route(latexRoutes.setFileEntrypoint)
    setFileEntrypoint(@Param('teamId') teamId: string, @Param('documentId') documentId: string, @Param('fileId') fileId: string) {
        return this.#service.setFileEntrypoint({ teamId, documentId, fileId });
    }

    

    @Route(latexRoutes.listFolders)
    listFolders(@Param('teamId') teamId: string, @Query() query: Record<string, string>) {
        return this.#service.listFolders({ teamId, ...query });
    }

    @Route(latexRoutes.getFolder)
    getFolder(@Param('teamId') teamId: string, @Param('folderId') folderId: string) {
        return this.#service.getFolder({ teamId, folderId });
    }

    @Route(latexRoutes.createFolder)
    @Status(201)
    createFolder(@Param('teamId') teamId: string, @CurrentUser() userId: string, @Body() body: CreateLatexFolderInput) {
        return this.#service.createFolder({ teamId, userId, ...body });
    }

    @Route(latexRoutes.updateFolder)
    updateFolder(@Param('teamId') teamId: string, @Param('folderId') folderId: string, @Body() body: UpdateLatexFolderInput) {
        return this.#service.updateFolder({ teamId, folderId, ...body });
    }

    @Route(latexRoutes.removeFolder)
    async removeFolder(@Param('teamId') teamId: string, @Param('folderId') folderId: string) {
        await this.#service.deleteFolder({ teamId, folderId });
    }

    
    #pipeStream(res: Response, stream: Readable, headers: Record<string, string>): Promise<void> {
        return new Promise<void>((resolve) => {
            for (const [name, value] of Object.entries(headers)) {
                res.setHeader(name, value);
            }

            res.on('close', () => {
                stream.destroy();
                resolve();
            });

            res.on('finish', () => {
                resolve();
            });

            stream.on('error', (error: unknown) => {
                logger.error(error);

                if (!res.headersSent) {
                    BaseResponse.fromError(res, error);
                } else {
                    res.destroy(error instanceof Error ? error : undefined);
                }

                resolve();
            });

            stream.pipe(res);
        });
    }
}
