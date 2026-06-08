import { ErrorCodes } from '@core/constants/error-codes';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import type {
    LatexCloseDocumentPayload,
    LatexFileJoinPayload,
    LatexFileLeavePayload,
    LatexFileUpdatePayload,
    LatexOpenDocumentPayload,
    LatexUpdateContentPayload
} from './LatexSocketPayloads';
import * as Y from 'yjs';

/** Debounce in ms before persisting a received content update to the database. */
const PERSIST_DEBOUNCE_MS = 500;

/** Key used to uniquely identify a pending save timer for a document file. */
const buildSaveKey = (documentId: string, fileId: string): string => `${documentId}:${fileId}`;
const LATEX_Y_TEXT_NAME = 'content';
const SERVER_INIT_ORIGIN = 'server:init';

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

interface LatexFileSession {
    documentId: string;
    teamId: string;
    fileId: string;
    doc: Y.Doc;
    text: Y.Text;
}

interface LatexFileJoinAck {
    documentId: string;
    fileId: string;
    content: string;
    update: number[];
}

const ackOk = <T>(data: T): SocketAck<T> => ({ ok: true, data });
const ackError = (error: string): SocketAck<never> => ({ ok: false, error });

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class LatexSocketModule extends BaseSocketModule {
    public readonly name = 'LatexSocketModule';

    /** Pending auto-save timers keyed by `{documentId}` or `{documentId}:{fileId}`. */
    private readonly saveTimers = new Map<string, NodeJS.Timeout>();

    private readonly fileSessions = new Map<string, LatexFileSession>();

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly listFilesUseCase: ListLatexFilesUseCase,
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
        this.registerFileJoin(connection);
        this.registerFileLeave(connection);
        this.registerFileUpdate(connection);
        this.wirePresenceOnDisconnect(
            connection,
            (conn) => this.getRoomFromConnection(conn),
            'latex_users_update',
            this.toPresenceUser
        );
    }

    async onShutdown(): Promise<void> {
        await Promise.all(Array.from(this.fileSessions.values()).map((session) => (
            this.persistContent(session.documentId, session.teamId, session.fileId, session.text.toString())
        )));

        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }
        this.saveTimers.clear();
        this.fileSessions.clear();
    }

    private registerOpenDocument(connection: ISocketConnection): void {
        this.on<LatexOpenDocumentPayload>(connection.id, 'latex_open_document', async (conn, payload) => {
            if (!conn.user?.teams?.includes(payload.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return;
            }

            const { documentId, teamId } = payload;
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
            const room = this.buildRoomId(payload.documentId);
            await this.leaveRoom(conn.id, room);

            delete conn.data['latexDocumentId'];
            delete conn.data['latexTeamId'];

            await this.broadcastPresence(room, 'latex_users_update', this.toPresenceUser);

            logger.info(`@latex-socket - user ${conn.user?._id} closed document ${payload.documentId}`);
        });
    }

    private registerUpdateContent(connection: ISocketConnection): void {
        this.on<LatexUpdateContentPayload>(connection.id, 'latex_update_content', (conn, payload) => {
            if (!conn.user?.teams?.includes(payload.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return;
            }

            const { documentId, teamId, fileId, content, timestamp } = payload;
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

    private registerFileJoin(connection: ISocketConnection): void {
        this.on<LatexFileJoinPayload, SocketAck<LatexFileJoinAck>>(connection.id, 'latex_file_join', async (conn, payload) => {
            if (!conn.user?.teams?.includes(payload.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return ackError('You are not a member of this team');
            }

            const session = await this.getOrCreateFileSession(
                payload.documentId,
                payload.teamId,
                payload.fileId
            );

            if (!session) {
                this.emitErrorToSocket(conn.id, ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
                return ackError('LaTeX file not found');
            }

            const room = this.buildFileRoomId(payload.documentId, payload.fileId);
            await this.joinRoom(conn.id, room);

            return ackOk({
                documentId: payload.documentId,
                fileId: payload.fileId,
                content: session.text.toString(),
                update: Array.from(Y.encodeStateAsUpdate(session.doc))
            });
        });
    }

    private registerFileLeave(connection: ISocketConnection): void {
        this.on<LatexFileLeavePayload>(connection.id, 'latex_file_leave', async (conn, payload) => {
            await this.leaveRoom(conn.id, this.buildFileRoomId(payload.documentId, payload.fileId));
            await this.releaseFileSessionIfIdle(payload.documentId, payload.fileId);
        });
    }

    private registerFileUpdate(connection: ISocketConnection): void {
        this.on<LatexFileUpdatePayload>(connection.id, 'latex_file_update', async (conn, payload) => {
            if (!conn.user?.teams?.includes(payload.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return ackError('You are not a member of this team');
            }

            const room = this.buildFileRoomId(payload.documentId, payload.fileId);
            if (!this.roomManager.isInRoom(conn.id, room)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Socket has not joined this LaTeX file'
                );
                return ackError('Socket has not joined this LaTeX file');
            }

            const session = await this.getOrCreateFileSession(
                payload.documentId,
                payload.teamId,
                payload.fileId
            );

            if (!session) {
                this.emitErrorToSocket(conn.id, ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
                return ackError('LaTeX file not found');
            }

            const update = new Uint8Array(payload.update);
            Y.applyUpdate(session.doc, update, conn.id);
            return ackOk({
                documentId: payload.documentId,
                fileId: payload.fileId
            });
        });
    }

    private async getOrCreateFileSession(
        documentId: string,
        teamId: string,
        fileId: string
    ): Promise<LatexFileSession | null> {
        const key = buildSaveKey(documentId, fileId);
        const existing = this.fileSessions.get(key);
        if (existing) {
            return existing.teamId === teamId ? existing : null;
        }

        const filesResult = await this.listFilesUseCase.execute({ documentId, teamId });
        if (!filesResult.success) {
            logger.warn(`@latex-socket - failed to load files for document ${documentId}: ${filesResult.error.message}`);
            return null;
        }

        const file = filesResult.value.find((candidate) => candidate._id === fileId);
        if (!file) {
            return null;
        }

        const doc = new Y.Doc();
        const text = doc.getText(LATEX_Y_TEXT_NAME);
        if (file.content) {
            doc.transact(() => {
                text.insert(0, file.content);
            }, SERVER_INIT_ORIGIN);
        }

        const session: LatexFileSession = {
            documentId,
            teamId,
            fileId,
            doc,
            text
        };

        doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === SERVER_INIT_ORIGIN) {
                return;
            }

            const room = this.buildFileRoomId(documentId, fileId);
            if (typeof origin === 'string') {
                this.emitToRoomExcept(origin, room, 'latex_file_update_applied', {
                    documentId,
                    fileId,
                    update: Array.from(update),
                    senderId: origin
                });
            } else {
                this.emitToRoom(room, 'latex_file_update_applied', {
                    documentId,
                    fileId,
                    update: Array.from(update)
                });
            }

            this.schedulePersist(documentId, teamId, fileId, text.toString());
        });

        this.fileSessions.set(key, session);
        return session;
    }

    private async releaseFileSessionIfIdle(documentId: string, fileId: string): Promise<void> {
        const room = this.buildFileRoomId(documentId, fileId);
        const sockets = await this.roomManager.getSocketsInRoom(room);
        if (sockets.length > 0) {
            return;
        }

        const key = buildSaveKey(documentId, fileId);
        const session = this.fileSessions.get(key);
        if (!session) {
            return;
        }

        const timer = this.saveTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.saveTimers.delete(key);
        }

        await this.persistContent(session.documentId, session.teamId, session.fileId, session.text.toString());
        session.doc.destroy();
        this.fileSessions.delete(key);
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

    private buildFileRoomId(documentId: string, fileId: string): string {
        return `latex-file-${documentId}-${fileId}`;
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
}
