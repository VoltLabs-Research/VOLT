import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import WhiteboardModel, { requireWhiteboardStorageClusterId } from '@modules/whiteboards/models/WhiteboardModel';
import type { WhiteboardDocument, WhiteboardLastEditedBy } from '@modules/whiteboards/models/WhiteboardModel';
import WhiteboardCreatedEvent from '@modules/whiteboards/events/WhiteboardCreatedEvent';
import WhiteboardDeletedEvent from '@modules/whiteboards/events/WhiteboardDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type {
    IClusterObjectSignedUrlService,
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { LAST_EDITED_BY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const EMPTY_STATE = Buffer.from(JSON.stringify({ revision: 0, elements: [], appState: {} }));
const EMPTY_SCENE_JSON = JSON.stringify({ revision: 0, elements: [], appState: {} });

interface WhiteboardFolderView {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface WhiteboardListItemView {
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardLastEditedBy;
    createdAt: Date;
    updatedAt: Date;
}

const presentLastEditedBy = (value: unknown): WhiteboardLastEditedBy => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
        const user = value as Record<string, unknown>;
        return {
            _id: String(user._id),
            firstName: typeof user.firstName === 'string' ? user.firstName : undefined,
            lastName: typeof user.lastName === 'string' ? user.lastName : undefined,
            email: typeof user.email === 'string' ? user.email : undefined,
            avatar: typeof user.avatar === 'string' ? user.avatar : undefined
        };
    }
    return String(value);
};

/**
 * The single application service for the whiteboards module (pollium style):
 * holds every whiteboard HTTP use case + the catalog-folder CRUD, `new`s nothing
 * stateful of its own, and talks to the Mongoose {@link WhiteboardModel} /
 * shared CatalogFolderModel directly — no repository, entity, mapper, use case
 * or DI on the service. The genuinely-shared collaborators (object-storage
 * gateway, signed-url service, cluster selection, event bus) are resolved once
 * from the DI container via their neutral tokens. Throws typed
 * {@link ApplicationError}s (no Result channel). The live collaborative-editing
 * state lives in the separate stateful `WhiteboardRealtimeStateService`
 * singleton (driven by the socket module), not here.
 */
export default class WhiteboardService {
    #objectGatewayClient = diContainer.resolve<ITeamClusterObjectGatewayClient>(SHARED_TOKENS.TeamClusterObjectGatewayClient);
    #signedUrlService = diContainer.resolve<IClusterObjectSignedUrlService>(CLUSTER_ACCESS_TOKENS.ClusterObjectSignedUrlService);
    #clusterSelection = diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    // ---- Whiteboards ------------------------------------------------------

    async createWhiteboard(teamId: string, userId: string, input: { title: string; folderId?: string | null }) {
        if (input.folderId) {
            const folder = await CatalogFolderModel.findOne({ _id: input.folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target whiteboard folder not found');
            }
        }

        const storageClusterId = await this.#clusterSelection.resolveStorageClusterId(teamId);

        const whiteboard = new WhiteboardModel({
            team: new mongoose.Types.ObjectId(teamId),
            createdBy: new mongoose.Types.ObjectId(userId),
            lastEditedBy: new mongoose.Types.ObjectId(userId),
            title: input.title,
            folder: input.folderId ? new mongoose.Types.ObjectId(input.folderId) : null,
            storageClusterId,
            payloadKey: ''
        });
        await whiteboard.save();

        const payloadKey = `${teamId}/${String(whiteboard._id)}/state.json`;

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: payloadKey,
            buffer: EMPTY_STATE,
            contentLength: EMPTY_STATE.byteLength,
            contentType: 'application/json'
        });

        whiteboard.payloadKey = payloadKey;
        await whiteboard.save();

        await this.#eventBus.publish(new WhiteboardCreatedEvent({
            whiteboardId: String(whiteboard._id),
            teamId,
            userId,
            whiteboardTitle: whiteboard.title ?? ''
        }));

        return {
            _id: String(whiteboard._id),
            title: whiteboard.title,
            folder: whiteboard.folder ? String(whiteboard.folder) : null,
            payloadKey,
            createdAt: whiteboard.createdAt,
            updatedAt: whiteboard.updatedAt
        };
    }

    async listWhiteboards(teamId: string, query: { folderId?: string; page?: number; limit?: number }): Promise<PaginatedResult<WhiteboardListItemView>> {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.max(1, Math.min(500, query.limit ?? 500));

        let folderId: string | null | 'all';
        if (!query.folderId) {
            folderId = 'all';
        } else if (query.folderId === 'root') {
            folderId = null;
        } else {
            folderId = query.folderId;
        }

        const filter: Record<string, unknown> = { team: teamId };
        if (folderId !== 'all') {
            filter.folder = folderId;
        }

        const [docs, total] = await Promise.all([
            WhiteboardModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ updatedAt: -1 })
                .populate(LAST_EDITED_BY_POPULATE)
                .exec(),
            WhiteboardModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#presentListItem(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getWhiteboard(teamId: string, whiteboardId: string) {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        return {
            _id: String(whiteboard._id),
            title: whiteboard.title,
            payloadKey: whiteboard.payloadKey,
            thumbnailKey: whiteboard.thumbnailKey,
            lastEditedBy: presentLastEditedBy(whiteboard.lastEditedBy),
            createdAt: whiteboard.createdAt,
            updatedAt: whiteboard.updatedAt
        };
    }

    async updateWhiteboard(teamId: string, whiteboardId: string, userId: string, input: { title?: string }) {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);
        if (input.title !== undefined) {
            whiteboard.title = input.title;
        }
        whiteboard.lastEditedBy = new mongoose.Types.ObjectId(userId);
        await whiteboard.save();

        return {
            _id: String(whiteboard._id),
            title: whiteboard.title,
            updatedAt: whiteboard.updatedAt
        };
    }

    async deleteWhiteboard(teamId: string, whiteboardId: string, userId: string): Promise<null> {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        await WhiteboardModel.deleteOne({ _id: whiteboardId });

        const prefix = `${teamId}/${whiteboardId}/`;
        const storageClusterId = requireWhiteboardStorageClusterId(String(whiteboard._id), whiteboard.storageClusterId);
        try {
            await this.#objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, prefix);
        } catch {
            // best-effort storage cleanup
        }

        await this.#eventBus.publish(new WhiteboardDeletedEvent({
            whiteboardId,
            teamId,
            userId,
            whiteboardTitle: whiteboard.title ?? ''
        }));

        return null;
    }

    async moveWhiteboard(teamId: string, whiteboardId: string, folderId: string | null): Promise<null> {
        const whiteboard = await WhiteboardModel.findOne({ _id: whiteboardId, team: teamId });
        if (!whiteboard) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
        }

        if (folderId !== null) {
            const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target Whiteboard folder not found');
            }
        }

        whiteboard.folder = folderId ? new mongoose.Types.ObjectId(folderId) : null;
        await whiteboard.save();
        return null;
    }

    async getWhiteboardState(teamId: string, whiteboardId: string): Promise<{ stream: Readable }> {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        if (!whiteboard.payloadKey) {
            throw ApplicationError.conflict('Whiteboard::PayloadKeyRequired', `Whiteboard ${String(whiteboard._id)} does not have a payload key assigned`);
        }

        const storageClusterId = requireWhiteboardStorageClusterId(String(whiteboard._id), whiteboard.storageClusterId);
        const key = whiteboard.payloadKey;
        const stateExists = await this.#objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);

        if (!stateExists) {
            return { stream: Readable.from(Buffer.from(EMPTY_SCENE_JSON)) };
        }

        const response = await this.#objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);
        return { stream: response.stream };
    }

    async saveWhiteboardState(teamId: string, whiteboardId: string, userId: string, stateBuffer: Buffer): Promise<null> {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        if (!whiteboard.payloadKey) {
            throw ApplicationError.conflict('Whiteboard::PayloadKeyRequired', `Whiteboard ${String(whiteboard._id)} does not have a payload key assigned`);
        }

        const key = whiteboard.payloadKey;
        const storageClusterId = requireWhiteboardStorageClusterId(String(whiteboard._id), whiteboard.storageClusterId);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: key,
            buffer: stateBuffer,
            contentLength: stateBuffer.byteLength,
            contentType: 'application/json'
        });

        whiteboard.lastEditedBy = new mongoose.Types.ObjectId(userId);
        await whiteboard.save();
        return null;
    }

    async uploadWhiteboardAsset(teamId: string, whiteboardId: string, userId: string, input: { fileName: string; size: number; type?: string }) {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        const assetId = uuidv4();
        const objectKey = `${teamId}/${whiteboardId}/assets/${assetId}`;
        const storageClusterId = requireWhiteboardStorageClusterId(String(whiteboard._id), whiteboard.storageClusterId);
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

    async getWhiteboardAsset(teamId: string, whiteboardId: string, assetId: string): Promise<{ stream: Readable; mimetype?: string }> {
        const whiteboard = await this.#getOwned(teamId, whiteboardId);

        const objectKey = `${teamId}/${whiteboardId}/assets/${assetId}`;
        const storageClusterId = requireWhiteboardStorageClusterId(String(whiteboard._id), whiteboard.storageClusterId);
        const response = await this.#objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, objectKey);

        return {
            stream: response.stream,
            mimetype: response.contentType
        };
    }

    // ---- Whiteboard folders ----------------------------------------------

    async listFolders(teamId: string, query: { parentId?: string | null; page?: number; limit?: number }): Promise<PaginatedResult<WhiteboardFolderView>> {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 500;
        const filter = { team: teamId, kind: CatalogFolderKind.Whiteboard, parent: query.parentId ?? null };

        const [docs, total] = await Promise.all([
            CatalogFolderModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }).exec(),
            CatalogFolderModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#presentFolder(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getFolder(teamId: string, folderId: string): Promise<WhiteboardFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }
        return this.#presentFolder(folder);
    }

    async createFolder(teamId: string, userId: string, input: { title: string; parentId?: string | null }): Promise<WhiteboardFolderView> {
        const folder = new CatalogFolderModel({
            team: new mongoose.Types.ObjectId(teamId),
            createdBy: new mongoose.Types.ObjectId(userId),
            title: input.title,
            parent: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
            kind: CatalogFolderKind.Whiteboard
        });
        await folder.save();
        return this.#presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: { title: string }): Promise<WhiteboardFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }
        folder.title = input.title;
        await folder.save();
        return this.#presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string, userId: string): Promise<null> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }

        await this.#deleteFolderTree(teamId, folderId, userId);
        return null;
    }

    // ---- Internal helpers -------------------------------------------------

    async #getOwned(teamId: string, whiteboardId: string): Promise<WhiteboardDocument> {
        const whiteboard = await WhiteboardModel.findOne({ _id: whiteboardId, team: teamId }).exec();
        if (!whiteboard) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
        }
        return whiteboard;
    }

    async #deleteFolderTree(teamId: string, folderId: string, userId: string): Promise<void> {
        const subfolders = await CatalogFolderModel.find({ team: teamId, parent: folderId, kind: CatalogFolderKind.Whiteboard });
        for (const subfolder of subfolders) {
            await this.#deleteFolderTree(teamId, String(subfolder._id), userId);
        }

        const whiteboards = await WhiteboardModel.find({ team: teamId, folder: folderId }).select('_id').exec();
        for (const doc of whiteboards) {
            await this.deleteWhiteboard(teamId, String(doc._id), userId);
        }

        await CatalogFolderModel.deleteOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Whiteboard });
    }

    #presentListItem(doc: WhiteboardDocument): WhiteboardListItemView {
        return {
            _id: String(doc._id),
            title: doc.title,
            folder: doc.folder ? String(doc.folder) : null,
            payloadKey: doc.payloadKey,
            thumbnailKey: doc.thumbnailKey,
            lastEditedBy: presentLastEditedBy(doc.lastEditedBy),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }

    #presentFolder(folder: { _id: unknown; title: string; parent: unknown; createdAt: Date; updatedAt: Date }): WhiteboardFolderView {
        return {
            _id: String(folder._id),
            title: folder.title,
            parent: folder.parent ? String(folder.parent) : null,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt
        };
    }
}
