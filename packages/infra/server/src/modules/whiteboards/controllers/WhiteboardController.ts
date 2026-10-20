import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { pipeStreamToResponse } from '@shared/http/responses/pipe-stream';
import whiteboardService from '@modules/whiteboards/services/WhiteboardService';
import whiteboardFolderService from '@modules/whiteboards/services/WhiteboardFolderService';
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
    @Route(whiteboardRoutes.create)
    @Status(201)
    createWhiteboard(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateWhiteboardInput>())) body: CreateWhiteboardInput
    ){
        return whiteboardService.createWhiteboard(teamId, userId, body);
    }

    @Route(whiteboardRoutes.list)
    listWhiteboards(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return whiteboardService.listWhiteboards(teamId, {
            folderId: query.folderId,
            ...readPage(query)
        });
    }

    @Route(whiteboardRoutes.listFolders)
    listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return whiteboardFolderService.listFolders(teamId, {
            parentId: query.parentId,
            ...readPage(query)
        });
    }

    @Route(whiteboardRoutes.getFolder)
    getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        return whiteboardFolderService.getFolder(teamId, folderId);
    }

    @Route(whiteboardRoutes.createFolder)
    @Status(201)
    createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateWhiteboardFolderInput>())) body: CreateWhiteboardFolderInput
    ){
        return whiteboardFolderService.createFolder(teamId, userId, body);
    }

    @Route(whiteboardRoutes.updateFolder)
    updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body(schemaBody(typia.createValidate<UpdateWhiteboardFolderInput>())) body: UpdateWhiteboardFolderInput
    ){
        return whiteboardFolderService.updateFolder(teamId, folderId, body);
    }

    @Route(whiteboardRoutes.removeFolder)
    removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @CurrentUser() userId: string
    ){
        return whiteboardFolderService.deleteFolder(teamId, folderId, userId);
    }

    @Route(whiteboardRoutes.get)
    getWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string
    ){
        return whiteboardService.getWhiteboard(teamId, whiteboardId);
    }

    @Route(whiteboardRoutes.update)
    updateWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<UpdateWhiteboardInput>())) body: UpdateWhiteboardInput
    ) {
        return whiteboardService.updateWhiteboard(teamId, whiteboardId, userId, body);
    }

    @Route(whiteboardRoutes.remove)
    deleteWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string
    ){
        return whiteboardService.deleteWhiteboard(teamId, whiteboardId, userId);
    }

    @Route(whiteboardRoutes.move)
    @Status(200)
    moveWhiteboard(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Body(schemaBody(typia.createValidate<MoveWhiteboardInput>())) body: MoveWhiteboardInput
    ){
        return whiteboardService.moveWhiteboard(teamId, whiteboardId, body.folderId);
    }

    @Route(whiteboardRoutes.getState)
    async getWhiteboardState(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Res() res: Response
    ): Promise<void>{
        const stream = await whiteboardService.getWhiteboardState(teamId, whiteboardId);
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
        return whiteboardService.saveWhiteboardState(teamId, whiteboardId, userId, Buffer.from(JSON.stringify(body)));
    }

    @Route(whiteboardRoutes.uploadAsset)
    @Status(201)
    uploadWhiteboardAsset(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<UploadWhiteboardAssetInput>())) body: UploadWhiteboardAssetInput
    ) {
        return whiteboardService.uploadWhiteboardAsset(teamId, whiteboardId, userId, body);
    }

    @Route(whiteboardRoutes.getAsset)
    async getWhiteboardAsset(
        @Param('teamId') teamId: string,
        @Param('whiteboardId') whiteboardId: string,
        @Param('assetId') assetId: string,
        @Res() res: Response
    ): Promise<void> {
        const output = await whiteboardService.getWhiteboardAsset(teamId, whiteboardId, assetId);
        await pipeStreamToResponse(res, output.stream, {
            'Content-Type': output.mimetype || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        });
    }
}
