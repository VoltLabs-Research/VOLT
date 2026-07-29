import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { whiteboardRoutes } from '@volt/contracts/modules/whiteboards/routes';
import type {
    CreateWhiteboardInput,
    UpdateWhiteboardInput,
    MoveWhiteboardInput,
    CreateWhiteboardFolderInput,
    UpdateWhiteboardFolderInput,
    UploadWhiteboardAssetInput
} from '@volt/contracts/modules/whiteboards/http';
import express from 'express';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

const stateBodyParser = express.json({ limit: '10mb' });

@Middleware(protect, teamScoped(Resource.WHITEBOARD))
export default class WhiteboardController extends Controller {
    #service = new WhiteboardService();

    @Route(whiteboardRoutes.create)
    @Status(201)
    createWhiteboard(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateWhiteboardInput
    ){
        return this.#service.createWhiteboard(teamId, userId, body);
    }

    @Route(whiteboardRoutes.list)
    listWhiteboards(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return this.#service.listWhiteboards(teamId, {
            folderId: query.folderId,
            page: query.page !== undefined ? Number(query.page) : undefined,
            limit: query.limit !== undefined ? Number(query.limit) : undefined
        });
    }

    @Route(whiteboardRoutes.listFolders)
    listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return this.#service.listFolders(teamId, {
            parentId: query.parentId,
            page: query.page !== undefined ? Number(query.page) : undefined,
            limit: query.limit !== undefined ? Number(query.limit) : undefined
        });
    }

    @Route(whiteboardRoutes.getFolder)
    getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        return this.#service.getFolder(teamId, folderId);
    }

    @Route(whiteboardRoutes.createFolder)
    @Status(201)
    createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateWhiteboardFolderInput
    ){
        return this.#service.createFolder(teamId, userId, body);
    }

    @Route(whiteboardRoutes.updateFolder)
    updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body() body: UpdateWhiteboardFolderInput
    ){
        return this.#service.updateFolder(teamId, folderId, body);
    }

    @Route(whiteboardRoutes.removeFolder)
    async removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @CurrentUser() userId: string
    ){
        await this.#service.deleteFolder(teamId, folderId, userId);
    }

    @Route(whiteboardRoutes.get)
    getWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string
    ){
        return this.#service.getWhiteboard(teamId, whiteboardId);
    }

    @Route(whiteboardRoutes.update)
    updateWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body() body: UpdateWhiteboardInput
    ) {
        return this.#service.updateWhiteboard(teamId, whiteboardId, userId, body);
    }

    @Route(whiteboardRoutes.remove)
    async deleteWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string
    ){
        await this.#service.deleteWhiteboard(teamId, whiteboardId, userId);
    }

    @Route(whiteboardRoutes.move)
    @Status(200)
    async moveWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Body() body: MoveWhiteboardInput
    ){
        return this.#service.moveWhiteboard(teamId, whiteboardId, body.folderId);
    }

    @Route(whiteboardRoutes.getState)
    async getWhiteboardState(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#service.getWhiteboardState(teamId, whiteboardId);
        this.#pipeStream(res, output.stream, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        });
    }

    @Route(whiteboardRoutes.saveState)
    @Middleware(stateBodyParser)
    async saveWhiteboardState(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body() body: unknown
    ) {
        const stateBuffer = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
        await this.#service.saveWhiteboardState(teamId, whiteboardId, userId, stateBuffer);
    }

    @Route(whiteboardRoutes.uploadAsset)
    @Status(201)
    uploadWhiteboardAsset(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body() body: UploadWhiteboardAssetInput
    ) {
        return this.#service.uploadWhiteboardAsset(teamId, whiteboardId, userId, body);
    }

    @Route(whiteboardRoutes.getAsset)
    async getWhiteboardAsset(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Param('assetId') assetId: string,
        @Res() res: Response
    ): Promise<void> {
        const output = await this.#service.getWhiteboardAsset(teamId, whiteboardId, assetId);
        this.#pipeStream(res, output.stream, {
            'Content-Type': output.mimetype || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        });
    }

    #pipeStream(res: Response, stream: Readable, headers: Record<string, string>): void {
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
}
