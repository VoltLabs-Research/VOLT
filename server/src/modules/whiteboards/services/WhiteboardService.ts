import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import { requireWhiteboardStorageClusterId } from '@modules/whiteboards/contracts/whiteboard';
import type { WhiteboardLastEditedBy } from '@modules/whiteboards/contracts/whiteboard';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { EventName } from '@shared/events/EventGroup';
import type {
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';

const EMPTY_STATE = Buffer.from(JSON.stringify({
    revision: 0,
    elements: [],
    appState: {}
}));
const EMPTY_SCENE_JSON = JSON.stringify({
    revision: 0,
    elements: [],
    appState: {}
});

const DEFAULT_LIST_LIMIT = 500;

const LAST_EDITED_BY_SELECTION = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
} as const;

interface WhiteboardFolderView{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface WhiteboardListItemView{
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardLastEditedBy;
    createdAt: Date;
    updatedAt: Date;
}

type WhiteboardObjectGateway = Pick<
    ITeamClusterObjectGatewayClient,
    'putBuffer' | 'exists' | 'getStream' | 'deleteByPrefix'
>;

type WhiteboardClusterSelection = Pick<ITeamClusterSelectionService, 'resolveStorageClusterId'>;

type WhiteboardEventPublisher = Pick<IEventBus, 'emit'>;

export interface WhiteboardServiceDependencies{
    objectGatewayClient?: WhiteboardObjectGateway;
    clusterSelection?: WhiteboardClusterSelection;
    eventBus?: WhiteboardEventPublisher;
}

const presentLastEditedBy = (whiteboard: Whiteboard): WhiteboardLastEditedBy => {
    const user = whiteboard.lastEditedByRef;
    if(user){
        return {
            _id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar ?? undefined
        };
    }

    return whiteboard.lastEditedBy ?? null;
};

export default class WhiteboardService{
    #signedUrlService = new ClusterObjectSignedUrlService();

    #objectGatewayClient: WhiteboardObjectGateway;

    #clusterSelection: WhiteboardClusterSelection;

    #eventBus: WhiteboardEventPublisher | null;

    constructor(dependencies: WhiteboardServiceDependencies = {}){
        this.#objectGatewayClient = dependencies.objectGatewayClient ?? objectGatewayClient;
        this.#clusterSelection = dependencies.clusterSelection ?? teamClusterSelectionService;
        this.#eventBus = dependencies.eventBus ?? null;
    }

    async createWhiteboard(teamId: string, userId: string, input: { title: string; folderId?: string | null }){
        if(input.folderId){
            const folder = await CatalogFolder.findOneBy({
                id: input.folderId,
                team: teamId,
                kind: CatalogFolderKind.Whiteboard
            });
            if(!folder){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target whiteboard folder not found');
            }
        }

        const storageClusterId = await this.#clusterSelection.resolveStorageClusterId(teamId);

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

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: payloadKey,
            buffer: EMPTY_STATE,
            contentLength: EMPTY_STATE.byteLength,
            contentType: 'application/json'
        });

        await Object.assign(whiteboard, { payloadKey }).save();

        await this.#emit('whiteboard.created', {
            whiteboardId: whiteboard.id,
            teamId,
            userId,
            whiteboardTitle: whiteboard.title ?? ''
        });

        return {
            _id: whiteboard.id,
            title: whiteboard.title,
            folder: whiteboard.folder,
            payloadKey,
            createdAt: whiteboard.createdAt,
            updatedAt: whiteboard.updatedAt
        };
    }

    async listWhiteboards(teamId: string, query: { folderId?: string; page?: number; limit?: number }): Promise<PaginatedResult<WhiteboardListItemView>>{
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: DEFAULT_LIST_LIMIT });
        const where: FindOptionsWhere<Whiteboard> = { team: teamId };

        if(query.folderId){
            where.folder = query.folderId === 'root' ? IsNull() : query.folderId;
        }

        const [whiteboards, total] = await Whiteboard.findAndCount({
            where,
            relations: { lastEditedByRef: true },
            select: { lastEditedByRef: LAST_EDITED_BY_SELECTION },
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([whiteboards.map((whiteboard) => this.#presentListItem(whiteboard)), total], pageRequest);
    }

    async getWhiteboard(teamId: string, whiteboardId: string){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        return {
            _id: whiteboard.id,
            title: whiteboard.title,
            payloadKey: whiteboard.payloadKey,
            thumbnailKey: whiteboard.thumbnailKey ?? undefined,
            lastEditedBy: presentLastEditedBy(whiteboard),
            createdAt: whiteboard.createdAt,
            updatedAt: whiteboard.updatedAt
        };
    }

    async updateWhiteboard(teamId: string, whiteboardId: string, userId: string, input: { title?: string }){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        if(input.title !== undefined){
            whiteboard.title = input.title;
        }
        whiteboard.lastEditedBy = userId;
        await whiteboard.save();

        return {
            _id: whiteboard.id,
            title: whiteboard.title,
            updatedAt: whiteboard.updatedAt
        };
    }

    async deleteWhiteboard(teamId: string, whiteboardId: string, userId: string): Promise<null>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        await Whiteboard.delete({ id: whiteboardId });

        const prefix = `${teamId}/${whiteboardId}/`;
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        try{
            await this.#objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, prefix);
        }catch{
        }

        await this.#emit('whiteboard.deleted', {
            whiteboardId,
            teamId,
            userId,
            whiteboardTitle: whiteboard.title ?? ''
        });

        return null;
    }

    async moveWhiteboard(teamId: string, whiteboardId: string, folderId: string | null): Promise<null>{
        const whiteboard = await Whiteboard.findOneBy({
            id: whiteboardId,
            team: teamId
        });
        if(!whiteboard){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
        }

        if(folderId !== null){
            const folder = await CatalogFolder.findOneBy({
                id: folderId,
                team: teamId,
                kind: CatalogFolderKind.Whiteboard
            });
            if(!folder){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target Whiteboard folder not found');
            }
        }

        whiteboard.folder = folderId || null;
        await whiteboard.save();
        return null;
    }

    async getWhiteboardState(teamId: string, whiteboardId: string): Promise<{ stream: Readable }>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        if(!whiteboard.payloadKey){
            throw ApplicationError.conflict('Whiteboard::PayloadKeyRequired', `Whiteboard ${whiteboard.id} does not have a payload key assigned`);
        }

        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        const key = whiteboard.payloadKey;
        const stateExists = await this.#objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);

        if(!stateExists){
            return { stream: Readable.from(Buffer.from(EMPTY_SCENE_JSON)) };
        }

        const response = await this.#objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);
        return { stream: response.stream };
    }

    async saveWhiteboardState(teamId: string, whiteboardId: string, userId: string, stateBuffer: Buffer): Promise<null>{
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        if(!whiteboard.payloadKey){
            throw ApplicationError.conflict('Whiteboard::PayloadKeyRequired', `Whiteboard ${whiteboard.id} does not have a payload key assigned`);
        }

        const key = whiteboard.payloadKey;
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: key,
            buffer: stateBuffer,
            contentLength: stateBuffer.byteLength,
            contentType: 'application/json'
        });

        whiteboard.lastEditedBy = userId;
        await whiteboard.save();
        return null;
    }

    async uploadWhiteboardAsset(teamId: string, whiteboardId: string, userId: string, input: { fileName: string; size: number; type?: string }){
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        const assetId = uuidv4();
        const objectKey = `${teamId}/${whiteboardId}/assets/${assetId}`;
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        const signed = this.#signedUrlService.createToken({
            kind: 'cluster-object',
            operation: 'write',
            teamId,
            userId,
            ownerClusterId: storageClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey,
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

        const objectKey = `${teamId}/${whiteboardId}/assets/${assetId}`;
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        const response = await this.#objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, objectKey);

        return {
            stream: response.stream,
            mimetype: response.contentType
        };
    }

    async listFolders(teamId: string, query: { parentId?: string | null; page?: number; limit?: number }): Promise<PaginatedResult<WhiteboardFolderView>>{
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: DEFAULT_LIST_LIMIT });
        const [folders, total] = await CatalogFolder.findAndCount({
            where: {
                team: teamId,
                kind: CatalogFolderKind.Whiteboard,
                parent: query.parentId ?? IsNull()
            },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([folders.map((folder) => this.#presentFolder(folder)), total], pageRequest);
    }

    async getFolder(teamId: string, folderId: string): Promise<WhiteboardFolderView>{
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
        if(!folder){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }
        return this.#presentFolder(folder);
    }

    async createFolder(teamId: string, userId: string, input: { title: string; parentId?: string | null }): Promise<WhiteboardFolderView>{
        const folder = await CatalogFolder.create({
            team: teamId,
            createdBy: userId,
            title: input.title,
            parent: input.parentId || null,
            kind: CatalogFolderKind.Whiteboard
        }).save();
        return this.#presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: { title: string }): Promise<WhiteboardFolderView>{
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
        if(!folder){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }
        folder.title = input.title;
        await folder.save();
        return this.#presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string, userId: string): Promise<null>{
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
        if(!folder){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }

        await this.#deleteFolderTree(teamId, folderId, userId);
        return null;
    }

    async #emit<K extends EventName>(name: K, payload: EventMap[K]): Promise<void>{
        this.#eventBus ??= (await import('@shared/infrastructure/events/RedisEventBus')).default;
        await this.#eventBus.emit(name, payload);
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

    async #deleteFolderTree(teamId: string, folderId: string, userId: string): Promise<void>{
        const subfolders = await CatalogFolder.findBy({
            team: teamId,
            parent: folderId,
            kind: CatalogFolderKind.Whiteboard
        });
        for(const subfolder of subfolders){
            await this.#deleteFolderTree(teamId, subfolder.id, userId);
        }

        const whiteboards = await Whiteboard.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });
        for(const whiteboard of whiteboards){
            await this.deleteWhiteboard(teamId, whiteboard.id, userId);
        }

        await CatalogFolder.delete({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
    }

    #presentListItem(whiteboard: Whiteboard): WhiteboardListItemView{
        return {
            _id: whiteboard.id,
            title: whiteboard.title,
            folder: whiteboard.folder,
            payloadKey: whiteboard.payloadKey,
            thumbnailKey: whiteboard.thumbnailKey ?? undefined,
            lastEditedBy: presentLastEditedBy(whiteboard),
            createdAt: whiteboard.createdAt,
            updatedAt: whiteboard.updatedAt
        };
    }

    #presentFolder(folder: CatalogFolder): WhiteboardFolderView{
        return {
            _id: folder.id,
            title: folder.title,
            parent: folder.parent,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt
        };
    }
}
