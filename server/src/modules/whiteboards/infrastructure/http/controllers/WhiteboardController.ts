import type WhiteboardService from '@modules/whiteboards/application/WhiteboardService';
import type { CreateWhiteboardInputDTO } from '@modules/whiteboards/application/dtos/CreateWhiteboardDTO';
import type { DeleteWhiteboardInputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardDTO';
import type { GetWhiteboardAssetInputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';
import type { GetWhiteboardInputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardDTO';
import type { GetWhiteboardStateInputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardStateDTO';
import type { ListWhiteboardsInputDTO } from '@modules/whiteboards/application/dtos/ListWhiteboardsDTO';
import type { MoveWhiteboardInputDTO } from '@modules/whiteboards/application/dtos/MoveWhiteboardDTO';
import type { SaveWhiteboardStateInputDTO } from '@modules/whiteboards/application/dtos/SaveWhiteboardStateDTO';
import type { UpdateWhiteboardInputDTO } from '@modules/whiteboards/application/dtos/UpdateWhiteboardDTO';
import type { UploadWhiteboardAssetInputDTO } from '@modules/whiteboards/application/dtos/UploadWhiteboardAssetDTO';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the whiteboards module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did for
 * the generated controllers, delegating to {@link WhiteboardService}, and
 * responding via {@link BaseResponse}. `listWhiteboards` reproduces the former
 * `createPaginatedController` behaviour; `getWhiteboardState` and
 * `getWhiteboardAsset` reproduce the former `createStreamController` behaviour
 * verbatim (headers, request-close and stream-error handling, then piping the
 * stream to the response). Handlers are arrow-function properties so `this` stays
 * bound when passed by reference to the router. Thrown `ApplicationError`s
 * propagate to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class WhiteboardController {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardService) private readonly whiteboardService: WhiteboardService
    ) {}

    createWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateWhiteboardInputDTO;
        const value = await this.whiteboardService.createWhiteboard(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    listWhiteboards = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListWhiteboardsInputDTO;
        const value = await this.whiteboardService.listWhiteboards(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    getWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetWhiteboardInputDTO;
        const value = await this.whiteboardService.getWhiteboard(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateWhiteboardInputDTO;
        const value = await this.whiteboardService.updateWhiteboard(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteWhiteboardInputDTO;
        await this.whiteboardService.deleteWhiteboard(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    moveWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as MoveWhiteboardInputDTO;
        const value = await this.whiteboardService.moveWhiteboard(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getWhiteboardState = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetWhiteboardStateInputDTO;
        const output = await this.whiteboardService.getWhiteboardState(input);

        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        };
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            output.stream.destroy();
        });

        output.stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        output.stream.pipe(res);
    };

    saveWhiteboardState = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req, (request, params) => ({
            ...params,
            userId: request.userId,
            stateBuffer: Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body))
        })) as unknown as SaveWhiteboardStateInputDTO;
        await this.whiteboardService.saveWhiteboardState(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    uploadWhiteboardAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UploadWhiteboardAssetInputDTO;
        const value = await this.whiteboardService.uploadWhiteboardAsset(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    getWhiteboardAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetWhiteboardAssetInputDTO;
        const output = await this.whiteboardService.getWhiteboardAsset(input);

        const headers = {
            'Content-Type': output.mimetype || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            output.stream.destroy();
        });

        output.stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        output.stream.pipe(res);
    };
}
