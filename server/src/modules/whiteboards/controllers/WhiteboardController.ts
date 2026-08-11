import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { pipeStreamToResponse } from '@shared/infrastructure/http/responses/pipe-stream';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import WhiteboardFolderService from '@modules/whiteboards/services/WhiteboardFolderService';
import { whiteboardRoutes } from '@volt/contracts/modules/whiteboards/routes';
import type {
    CreateWhiteboardInput,
    UpdateWhiteboardInput,
    MoveWhiteboardInput,
    CreateWhiteboardFolderInput,
    UpdateWhiteboardFolderInput,
    UploadWhiteboardAssetInput,
    SaveWhiteboardStateInput
} from '@volt/contracts/modules/whiteboards/http';
import express from 'express';
import type { Response } from 'express';

const stateBodyParser = express.json({ limit: '10mb' });

const readPage = (query: Record<string, string>) => ({
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined
});

@Middleware(protect, teamScoped(Resource.WHITEBOARD))
export default class WhiteboardController extends Controller {
    #service = new WhiteboardService();

    #folders = new WhiteboardFolderService();

    @Route(whiteboardRoutes.create)
    @Status(201)
    createWhiteboard(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateWhiteboardInput>())) body: CreateWhiteboardInput
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
            ...readPage(query)
        });
    }

    @Route(whiteboardRoutes.listFolders)
    listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return this.#folders.listFolders(teamId, {
            parentId: query.parentId,
            ...readPage(query)
        });
    }

    @Route(whiteboardRoutes.getFolder)
    getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        return this.#folders.getFolder(teamId, folderId);
    }

    @Route(whiteboardRoutes.createFolder)
    @Status(201)
    createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateWhiteboardFolderInput>())) body: CreateWhiteboardFolderInput
    ){
        return this.#folders.createFolder(teamId, userId, body);
    }

    @Route(whiteboardRoutes.updateFolder)
    updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body(schemaBody(typia.createValidate<UpdateWhiteboardFolderInput>())) body: UpdateWhiteboardFolderInput
    ){
        return this.#folders.updateFolder(teamId, folderId, body);
    }

    @Route(whiteboardRoutes.removeFolder)
    removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @CurrentUser() userId: string
    ){
        return this.#folders.deleteFolder(teamId, folderId, userId);
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
        @Body(schemaBody(typia.createValidate<UpdateWhiteboardInput>())) body: UpdateWhiteboardInput
    ) {
        return this.#service.updateWhiteboard(teamId, whiteboardId, userId, body);
    }

    @Route(whiteboardRoutes.remove)
    deleteWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string
    ){
        return this.#service.deleteWhiteboard(teamId, whiteboardId, userId);
    }

    @Route(whiteboardRoutes.move)
    @Status(200)
    moveWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Body(schemaBody(typia.createValidate<MoveWhiteboardInput>())) body: MoveWhiteboardInput
    ){
        return this.#service.moveWhiteboard(teamId, whiteboardId, body.folderId);
    }

    @Route(whiteboardRoutes.getState)
    async getWhiteboardState(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Res() res: Response
    ): Promise<void>{
        const stream = await this.#service.getWhiteboardState(teamId, whiteboardId);
        await pipeStreamToResponse(res, stream, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        });
    }

    @Route(whiteboardRoutes.saveState)
    @Middleware(stateBodyParser)
    saveWhiteboardState(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<SaveWhiteboardStateInput>())) body: SaveWhiteboardStateInput
    ) {
        return this.#service.saveWhiteboardState(teamId, whiteboardId, userId, Buffer.from(JSON.stringify(body)));
    }

    @Route(whiteboardRoutes.uploadAsset)
    @Status(201)
    uploadWhiteboardAsset(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<UploadWhiteboardAssetInput>())) body: UploadWhiteboardAssetInput
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
        await pipeStreamToResponse(res, output.stream, {
            'Content-Type': output.mimetype || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        });
    }
}
