import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager, PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';
import type {
    LatexCloseDocumentPayload,
    LatexOpenDocumentPayload,
    LatexUpdateContentPayload
} from './LatexSocketPayloads';
import {
    latexCloseDocumentSchema,
    latexOpenDocumentSchema,
    latexUpdateContentSchema
} from './LatexSocketPayloads';

/** Debounce in ms before persisting a received content update to the database. */
const PERSIST_DEBOUNCE_MS = 2_000;

/** Key used to uniquely identify a pending save timer for a document file. */
const buildSaveKey = (documentId: string, fileId: string): string => `${documentId}:${fileId}`;

@injectable()
export default class LatexSocketModule extends BaseSocketModule {
    public readonly name = 'LatexSocketModule';

    /** Pending auto-save timers keyed by `{documentId}` or `{documentId}:{fileId}`. */
    private readonly saveTimers = new Map<string, NodeJS.Timeout>();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        private readonly updateFileUseCase: UpdateLatexFileUseCase
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerOpenDocument(connection);
        this.registerCloseDocument(connection);
        this.registerUpdateContent(connection);
        this.wirePresenceOnDisconnect(
            connection,
            (conn) => this.getRoomFromConnection(conn),
            'latex_users_update',
            this.toPresenceUser
        );
    }

    async onShutdown(): Promise<void> {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }
        this.saveTimers.clear();
    }

    private registerOpenDocument(connection: ISocketConnection): void {
        this.on<LatexOpenDocumentPayload>(connection.id, 'latex_open_document', async (conn, payload) => {
            const parsed = latexOpenDocumentSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            if (!conn.user?.teams?.includes(parsed.data.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return;
            }

            const { documentId, teamId } = parsed.data;
            const prevDocId = conn.data['latexDocumentId'] as string | undefined;

            if (prevDocId && prevDocId !== documentId) {
                const prevRoom = this.buildRoomId(prevDocId);
                await this.leaveRoom(conn.id, prevRoom);
                await this.broadcastPresence(prevRoom, 'latex_users_update', this.toPresenceUser);
            }

            const room = this.buildRoomId(documentId);
            conn.data['latexDocumentId'] = documentId;
            conn.data['latexTeamId'] = teamId;

            await this.joinRoom(conn.id, room);
            await this.broadcastPresence(room, 'latex_users_update', this.toPresenceUser);
        });
    }

    private registerCloseDocument(connection: ISocketConnection): void {
        this.on<LatexCloseDocumentPayload>(connection.id, 'latex_close_document', async (conn, payload) => {
            const parsed = latexCloseDocumentSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            const room = this.buildRoomId(parsed.data.documentId);
            await this.leaveRoom(conn.id, room);

            delete conn.data['latexDocumentId'];
            delete conn.data['latexTeamId'];

            await this.broadcastPresence(room, 'latex_users_update', this.toPresenceUser);

            logger.info(`@latex-socket - user ${conn.user?._id} closed document ${parsed.data.documentId}`);
        });
    }

    private registerUpdateContent(connection: ISocketConnection): void {
        this.on<LatexUpdateContentPayload>(connection.id, 'latex_update_content', (conn, payload) => {
            const parsed = latexUpdateContentSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            if (!conn.user?.teams?.includes(parsed.data.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return;
            }

            const { documentId, teamId, fileId, content, timestamp } = parsed.data;
            const room = this.buildRoomId(documentId);

            if (!this.roomManager.isInRoom(conn.id, room)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Socket has not opened this document'
                );
                return;
            }

            this.emitToRoomExcept(conn.id, room, 'latex_content_updated', {
                documentId,
                fileId,
                content,
                timestamp,
                senderId: conn.user?._id
            });

            this.schedulePersist(documentId, teamId, fileId, content);
        });
    }

    /**
     * Debounced persist: only writes to DB once activity stops for PERSIST_DEBOUNCE_MS.
     * Keyed by `{documentId}:{fileId}` when a file is specified, so concurrent edits
     * to different files in the same document do not cancel each other's timers.
     */
    private schedulePersist(documentId: string, teamId: string, fileId: string, content: string): void {
        const saveKey = buildSaveKey(documentId, fileId);
        const existing = this.saveTimers.get(saveKey);

        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.saveTimers.delete(saveKey);
            this.persistContent(documentId, teamId, fileId, content);
        }, PERSIST_DEBOUNCE_MS);

        this.saveTimers.set(saveKey, timer);
    }

    private async persistContent(
        documentId: string,
        teamId: string,
        fileId: string,
        content: string
    ): Promise<void> {
        try {
            const result = await this.updateFileUseCase.execute({
                documentId,
                teamId,
                fileId,
                content
            });
            if (!result.success) {
                logger.warn(`@latex-socket - auto-save failed for file ${fileId}: ${result.error?.message}`);
            }
        } catch (error) {
            logger.error(`@latex-socket - auto-save error for document ${documentId}: ${error}`);
        }
    }

    private buildRoomId(documentId: string): string {
        return `latex-doc-${documentId}`;
    }

    private getRoomFromConnection(connection: ISocketConnection): string | undefined {
        const id = connection.data['latexDocumentId'] as string | undefined;
        return id ? this.buildRoomId(id) : undefined;
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
};
