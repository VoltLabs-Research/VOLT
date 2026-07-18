import type LatexService from '@modules/latex/application/LatexService';
import type { CompileLatexDocumentInputDTO } from '@modules/latex/application/dtos/CompileLatexDocumentDTO';
import type { CreateLatexDocumentInputDTO } from '@modules/latex/application/dtos/CreateLatexDocumentDTO';
import type { CreateLatexFileInputDTO } from '@modules/latex/application/dtos/CreateLatexFileDTO';
import type { DeleteLatexAssetInputDTO } from '@modules/latex/application/dtos/DeleteLatexAssetDTO';
import type { DeleteLatexDocumentInputDTO } from '@modules/latex/application/dtos/DeleteLatexDocumentDTO';
import type { DeleteLatexFileInputDTO } from '@modules/latex/application/dtos/DeleteLatexFileDTO';
import type { ExportLatexDocumentInputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import type { GetLatexAssetContentInputDTO } from '@modules/latex/application/dtos/GetLatexAssetContentDTO';
import type { GetLatexDocumentInputDTO } from '@modules/latex/application/dtos/GetLatexDocumentDTO';
import type { ImportLatexDocumentInputDTO } from '@modules/latex/application/dtos/ImportLatexDocumentDTO';
import type { ListLatexAssetsInputDTO } from '@modules/latex/application/dtos/ListLatexAssetsDTO';
import type { ListLatexDocumentsInputDTO } from '@modules/latex/application/dtos/ListLatexDocumentsDTO';
import type { ListLatexFilesInputDTO } from '@modules/latex/application/dtos/ListLatexFilesDTO';
import type { MoveLatexDocumentInputDTO } from '@modules/latex/application/dtos/MoveLatexDocumentDTO';
import type { SetLatexFileEntrypointInputDTO } from '@modules/latex/application/dtos/SetLatexFileEntrypointDTO';
import type { UpdateLatexAssetInputDTO } from '@modules/latex/application/dtos/UpdateLatexAssetDTO';
import type { UpdateLatexDocumentInputDTO } from '@modules/latex/application/dtos/UpdateLatexDocumentDTO';
import type { UpdateLatexFileInputDTO } from '@modules/latex/application/dtos/UpdateLatexFileDTO';
import type { UploadLatexAssetInputDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

/**
 * The single HTTP controller for the latex module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link LatexService}, and
 * responding via {@link BaseResponse}. `listDocuments` preserves the former
 * `createPaginatedController` shape; `exportDocumentTex`/`exportDocumentZip`/
 * `compileDocument` reproduce the `createPreparedDownloadStreamController`
 * behaviour (await `prepare()`, apply the prepared `headers`, pipe); and
 * `getAssetContent` reproduces the `createStreamController` behaviour with the
 * original custom header set. Handlers are arrow-function properties so `this`
 * stays bound when passed by reference to the router. Thrown `ApplicationError`s
 * propagate to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class LatexController {
    constructor(
        @inject(LATEX_TOKENS.LatexService) private readonly latexService: LatexService
    ) {}

    /**
     * Reproduces `BaseStreamController.handleSuccess` verbatim: applies the
     * response headers, wires the request-close and stream-error handlers, then
     * pipes the binary stream to the response.
     */
    private pipeStream(res: Response, stream: Readable, headers: Record<string, string>): void {
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            stream.destroy();
        });

        stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        stream.pipe(res);
    }

    listDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListLatexDocumentsInputDTO;
        const value = await this.latexService.listDocuments(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    createDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateLatexDocumentInputDTO;
        const value = await this.latexService.createDocument(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    importDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ImportLatexDocumentInputDTO;
        const value = await this.latexService.importDocument(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    getDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetLatexDocumentInputDTO;
        const value = await this.latexService.getDocument(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteLatexDocumentInputDTO;
        await this.latexService.deleteDocument(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    updateDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateLatexDocumentInputDTO;
        const value = await this.latexService.updateDocument(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    moveDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as MoveLatexDocumentInputDTO;
        const value = await this.latexService.moveDocument(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    listAssets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListLatexAssetsInputDTO;
        const value = await this.latexService.listAssets(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getAssetContent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetLatexAssetContentInputDTO;
        const output = await this.latexService.getAssetContent(input);

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

        this.pipeStream(res, output.stream, headers);
    };

    uploadAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UploadLatexAssetInputDTO;
        const value = await this.latexService.uploadAsset(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    deleteAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteLatexAssetInputDTO;
        await this.latexService.deleteAsset(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    updateAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateLatexAssetInputDTO;
        const value = await this.latexService.updateAsset(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    exportDocumentTex = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ExportLatexDocumentInputDTO;
        const output = await this.latexService.exportDocumentTex(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    exportDocumentZip = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ExportLatexDocumentInputDTO;
        const output = await this.latexService.exportDocumentZip(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    compileDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CompileLatexDocumentInputDTO;
        const output = await this.latexService.compileDocument(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    listFiles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListLatexFilesInputDTO;
        const value = await this.latexService.listFiles(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    createFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateLatexFileInputDTO;
        const value = await this.latexService.createFile(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    updateFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateLatexFileInputDTO;
        const value = await this.latexService.updateFile(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteLatexFileInputDTO;
        const value = await this.latexService.deleteFile(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    setFileEntrypoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SetLatexFileEntrypointInputDTO;
        const value = await this.latexService.setFileEntrypoint(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
