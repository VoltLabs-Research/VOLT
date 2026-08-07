import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import {
    EMPTY_WHITEBOARD_SCENE,
    requireWhiteboardPayloadKey,
    requireWhiteboardStorageClusterId
} from '@modules/whiteboards/contracts/whiteboard';
import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';

const EMPTY_STATE = Buffer.from(JSON.stringify(EMPTY_WHITEBOARD_SCENE));

const DEFAULT_LIST_LIMIT = 500;

const presentWhiteboard = (whiteboard: Whiteboard) => {
    const editor = whiteboard.lastEditedByRef;

    return {
        _id: whiteboard.id,
        title: whiteboard.title,
        folder: whiteboard.folder,
        payloadKey: whiteboard.payloadKey,
        lastEditedBy: editor
            ? {
                _id: editor.id,
                firstName: editor.firstName,
                lastName: editor.lastName,
                email: editor.email,
                avatar: editor.avatar ?? undefined
            }
            : whiteboard.lastEditedBy,
        createdAt: whiteboard.createdAt,
        updatedAt: whiteboard.updatedAt
    };
};

export default class WhiteboardService{
    #signedUrlService = new ClusterObjectSignedUrlService();

    async createWhiteboard(teamId: string, userId: string, input: { title: string; folderId?: string | null }){
        if(input.folderId){
            await this.#requireFolder(teamId, input.folderId);
        }

        const storageClusterId = await teamClusterSelectionService.resolveStorageClusterId(teamId);

        const whiteboard = await Whiteboard.create({
            team: teamId,
            createdBy: userId,
            lastEditedBy: userId,
            title: input.title,
            folder: input.folderId || null,
            storageClusterId,
            payloadKey: ''
        }).save();

        const payloadKey = `${teamId}/${whiteboard.id}/state.json`;

        await objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: payloadKey,
            buffer: EMPTY_STATE,
            contentLength: EMPTY_STATE.byteLength,
            contentType: 'application/json'
        });

        whiteboard.payloadKey = payloadKey;
        await whiteboard.save();

        await eventBus.emit('whiteboard.created', {
            whiteboardId: whiteboard.id,
            teamId,
            userId,
            whiteboardTitle: whiteboard.title
        });

        return presentWhiteboard(whiteboard);
    }

    async listWhiteboards(teamId: string, query: { folderId?: string; page?: number; limit?: number }){
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: DEFAULT_LIST_LIMIT });
        const where: FindOptionsWhere<Whiteboard> = { team: teamId };

        if(query.folderId){
            where.folder = query.folderId === 'root' ? IsNull() : query.folderId;
        }

        const [whiteboards, total] = await Whiteboard.findAndCount({
            where,
            relations: { lastEditedByRef: true },
            select: {
                lastEditedByRef: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true
                }
            },
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([whiteboards.map(presentWhiteboard), total], pageRequest);
    }

    async getWhiteboard(teamId: string, whiteboardId: string){
        return presentWhiteboard(await this.#getOwned(teamId, whiteboardId));
    }

    async updateWhiteboard(teamId: string, whiteboardId: string, userId: string, input: { title?: string }){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        if(input.title !== undefined){
            whiteboard.title = input.title;
        }
        whiteboard.lastEditedBy = userId;
        await whiteboard.save();

        return presentWhiteboard(whiteboard);
    }

    async deleteWhiteboard(teamId: string, whiteboardId: string, userId: string): Promise<void>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        await Whiteboard.delete({ id: whiteboardId });

        try{
            await objectGatewayClient.deleteByPrefix(
                requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId),
                TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                `${teamId}/${whiteboardId}/`
            );
        }catch{
            // Best effort: the row is already gone, orphaned objects are reclaimed by the bucket lifecycle.
        }

        await eventBus.emit('whiteboard.deleted', {
            whiteboardId,
            teamId,
            userId,
            whiteboardTitle: whiteboard.title
        });
    }

    async moveWhiteboard(teamId: string, whiteboardId: string, folderId: string | null): Promise<void>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        if(folderId !== null){
            await this.#requireFolder(teamId, folderId);
        }

        whiteboard.folder = folderId;
        await whiteboard.save();
    }

    async getWhiteboardState(teamId: string, whiteboardId: string): Promise<Readable>{
        const { storageClusterId, payloadKey } = await this.#getStorageLocation(teamId, whiteboardId);

        if(!await objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey)){
            return Readable.from(EMPTY_STATE);
        }

        const response = await objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey);
        return response.stream;
    }

    async saveWhiteboardState(teamId: string, whiteboardId: string, userId: string, stateBuffer: Buffer): Promise<void>{
        const { whiteboard, storageClusterId, payloadKey } = await this.#getStorageLocation(teamId, whiteboardId);

        await objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: payloadKey,
            buffer: stateBuffer,
            contentLength: stateBuffer.byteLength,
            contentType: 'application/json'
        });

        whiteboard.lastEditedBy = userId;
        await whiteboard.save();
    }

    async uploadWhiteboardAsset(teamId: string, whiteboardId: string, userId: string, input: { fileName: string; size: number; type?: string }){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        const assetId = uuidv4();
        const signed = this.#signedUrlService.createToken({
            kind: 'cluster-object',
            operation: 'write',
            teamId,
            userId,
            ownerClusterId: requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId),
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: `${teamId}/${whiteboardId}/assets/${assetId}`,
            resourceKind: 'whiteboard',
            resourceId: whiteboardId,
            contentLength: input.size,
            contentType: input.type || 'application/octet-stream'
        });

        return {
            assetId,
            uploadUrl: signed.url,
            expiresAt: signed.expiresAt
        };
    }

    async getWhiteboardAsset(teamId: string, whiteboardId: string, assetId: string): Promise<{ stream: Readable; mimetype?: string }>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        const response = await objectGatewayClient.getStream(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            `${teamId}/${whiteboardId}/assets/${assetId}`
        );

        return {
            stream: response.stream,
            mimetype: response.contentType
        };
    }

    async #getOwned(teamId: string, whiteboardId: string): Promise<Whiteboard>{
        const whiteboard = await Whiteboard.findOneBy({
            id: whiteboardId,
            team: teamId
        });
        if(!whiteboard){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
        }
        return whiteboard;
    }

    async #getStorageLocation(teamId: string, whiteboardId: string){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        return {
            whiteboard,
            storageClusterId: requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId),
            payloadKey: requireWhiteboardPayloadKey(whiteboard.id, whiteboard.payloadKey)
        };
    }

    async #requireFolder(teamId: string, folderId: string): Promise<void>{
        const exists = await CatalogFolder.existsBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
        if(!exists){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target whiteboard folder not found');
        }
    }
}
