import { ErrorCodes } from '@core/constants/error-codes';
import type { ISocketConnection, PresenceUser } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { ackError, ackOk } from '@modules/socket/socket/socket-ack';
import logger from '@shared/infrastructure/logger';
import LatexFileSessionStore from '@modules/latex/socket/LatexFileSessionStore';
import type { SocketAck } from '@modules/socket/socket/socket-ack';
import type { LatexFileSession } from '@modules/latex/socket/LatexFileSessionStore';
import type {
    LatexCloseDocumentPayload,
    LatexFileJoinPayload,
    LatexFileLeavePayload,
    LatexFileUpdatePayload,
    LatexOpenDocumentPayload,
    LatexUpdateContentPayload
} from './LatexSocketPayloads';
import * as Y from 'yjs';

const JOINED_FILES = 'latexJoinedFiles';

interface LatexFileJoinAck {
    documentId: string;
    fileId: string;
    content: string;
    update: number[];
}

type JoinedLatexFile = Pick<LatexFileSession, 'documentId' | 'fileId'>;

const NOT_A_TEAM_MEMBER = 'You are not a member of this team';
const FILE_NOT_FOUND = 'LaTeX file not found';

class LatexSocketModule extends BaseSocketModule {
    public readonly name = 'LatexSocketModule';

    #sessions = new LatexFileSessionStore((session, update, origin) => {
        this.broadcastFileUpdate(session, update, origin);
    });

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
        this.registerDisconnect(connection);
        this.wirePresenceOnDisconnect(
            connection,
            this.getRoomFromConnection,
            'latex_users_update',
            this.toPresenceUser
        );
    }

    async onShutdown(): Promise<void> {
        await this.#sessions.flush();
    }

    public async applyAiContentToFile(
        documentId: string,
        teamId: string,
        fileId: string,
        content: string
    ): Promise<void> {
        await this.#sessions.applyAiContent(documentId, teamId, fileId, content);
    }

    private registerOpenDocument(connection: ISocketConnection): void {
        this.on<LatexOpenDocumentPayload>(connection.id, 'latex_open_document', async (conn, payload) => {
            if (!this.isTeamMember(conn, payload.teamId)) {
                return;
            }

            const { documentId } = payload;
            const prevDocId = conn.data['latexDocumentId'] as string | undefined;

            if (prevDocId && prevDocId !== documentId) {
                const prevRoom = this.buildRoomId(prevDocId);
                await this.leaveRoom(conn.id, prevRoom);
                await this.broadcastPresence(prevRoom, 'latex_users_update', this.toPresenceUser);
            }

            const room = this.buildRoomId(documentId);
            conn.data['latexDocumentId'] = documentId;

            await this.joinRoom(conn.id, room);
            await this.broadcastPresence(room, 'latex_users_update', this.toPresenceUser);
        });
    }

    private registerCloseDocument(connection: ISocketConnection): void {
        this.on<LatexCloseDocumentPayload>(connection.id, 'latex_close_document', async (conn, payload) => {
            const room = this.buildRoomId(payload.documentId);
            await this.leaveRoom(conn.id, room);

            delete conn.data['latexDocumentId'];

            await this.broadcastPresence(room, 'latex_users_update', this.toPresenceUser);

            logger.info(`@latex-socket - user ${conn.user?._id} closed document ${payload.documentId}`);
        });
    }

    private registerUpdateContent(connection: ISocketConnection): void {
        this.on<LatexUpdateContentPayload>(connection.id, 'latex_update_content', (conn, payload) => {
            if (!this.isTeamMember(conn, payload.teamId)) {
                return;
            }

            const { documentId, teamId, fileId, content, timestamp } = payload;
            const room = this.buildRoomId(documentId);

            if (!this.roomManager.isInRoom(conn.id, room)) {
                this.emitErrorToSocket(conn.id, ErrorCodes.VALIDATION_INVALID_INPUT, 'Socket has not opened this document');
                return;
            }

            this.emitToRoomExcept(conn.id, room, 'latex_content_updated', {
                documentId,
                fileId,
                content,
                timestamp,
                senderId: conn.user?._id
            });

            this.#sessions.schedulePersist(documentId, teamId, fileId, content);
        });
    }

    private registerFileJoin(connection: ISocketConnection): void {
        this.on<LatexFileJoinPayload, SocketAck<LatexFileJoinAck>>(connection.id, 'latex_file_join', async (conn, payload) => {
            if (!this.isTeamMember(conn, payload.teamId)) {
                return ackError(NOT_A_TEAM_MEMBER);
            }

            const session = await this.#sessions.acquire(
                payload.documentId,
                payload.teamId,
                payload.fileId
            );

            if (!session) {
                return this.reject(conn.id, ErrorCodes.LATEX_FILE_NOT_FOUND, FILE_NOT_FOUND);
            }

            const room = this.buildFileRoomId(payload.documentId, payload.fileId);
            await this.joinRoom(conn.id, room);
            this.trackJoinedFile(conn, payload.documentId, payload.fileId);

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
            this.untrackJoinedFile(conn, payload.documentId, payload.fileId);
            await this.releaseFileSessionIfIdle(payload.documentId, payload.fileId);
        });
    }

    private registerFileUpdate(connection: ISocketConnection): void {
        this.on<LatexFileUpdatePayload>(connection.id, 'latex_file_update', async (conn, payload) => {
            if (!this.isTeamMember(conn, payload.teamId)) {
                return ackError(NOT_A_TEAM_MEMBER);
            }

            const room = this.buildFileRoomId(payload.documentId, payload.fileId);
            if (!this.roomManager.isInRoom(conn.id, room)) {
                return this.reject(conn.id, ErrorCodes.VALIDATION_INVALID_INPUT, 'Socket has not joined this LaTeX file');
            }

            const session = await this.#sessions.acquire(
                payload.documentId,
                payload.teamId,
                payload.fileId
            );

            if (!session) {
                return this.reject(conn.id, ErrorCodes.LATEX_FILE_NOT_FOUND, FILE_NOT_FOUND);
            }

            Y.applyUpdate(session.doc, new Uint8Array(payload.update), conn.id);
            return ackOk({
                documentId: payload.documentId,
                fileId: payload.fileId
            });
        });
    }

    private registerDisconnect(connection: ISocketConnection): void {
        this.onDisconnect(connection.id, async (conn) => {
            const joinedFiles = this.joinedFilesOf(conn);
            if (!joinedFiles || joinedFiles.size === 0) {
                return;
            }

            await Promise.all(Array.from(joinedFiles.values()).map((joined) => (
                this.releaseFileSessionIfIdle(joined.documentId, joined.fileId)
            )));
            joinedFiles.clear();
        });
    }

    private isTeamMember(connection: ISocketConnection, teamId: string): boolean {
        if (connection.user?.teams?.includes(teamId)) {
            return true;
        }

        this.emitErrorToSocket(connection.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, NOT_A_TEAM_MEMBER);
        return false;
    }

    private reject(socketId: string, code: string, message: string): SocketAck<never> {
        this.emitErrorToSocket(socketId, code, message);
        return ackError(message);
    }

    private joinedFilesOf(connection: ISocketConnection): Map<string, JoinedLatexFile> | undefined {
        return connection.data[JOINED_FILES] as Map<string, JoinedLatexFile> | undefined;
    }

    private trackJoinedFile(connection: ISocketConnection, documentId: string, fileId: string): void {
        let joinedFiles = this.joinedFilesOf(connection);
        if (!joinedFiles) {
            joinedFiles = new Map<string, JoinedLatexFile>();
            connection.data[JOINED_FILES] = joinedFiles;
        }
        joinedFiles.set(this.buildFileRoomId(documentId, fileId), {
            documentId,
            fileId
        });
    }

    private untrackJoinedFile(connection: ISocketConnection, documentId: string, fileId: string): void {
        this.joinedFilesOf(connection)?.delete(this.buildFileRoomId(documentId, fileId));
    }

    private broadcastFileUpdate(session: LatexFileSession, update: Uint8Array, origin: unknown): void {
        const room = this.buildFileRoomId(session.documentId, session.fileId);
        const payload = {
            documentId: session.documentId,
            fileId: session.fileId,
            update: Array.from(update)
        };

        if (typeof origin === 'string') {
            this.emitToRoomExcept(origin, room, 'latex_file_update_applied', {
                ...payload,
                senderId: origin
            });
            return;
        }

        this.emitToRoom(room, 'latex_file_update_applied', payload);
    }

    private async releaseFileSessionIfIdle(documentId: string, fileId: string): Promise<void> {
        const sockets = await this.roomManager.getSocketsInRoom(this.buildFileRoomId(documentId, fileId));
        if (sockets.length > 0) {
            return;
        }

        await this.#sessions.release(documentId, fileId);
    }

    private buildRoomId(documentId: string): string {
        return `latex-doc-${documentId}`;
    }

    private buildFileRoomId(documentId: string, fileId: string): string {
        return `latex-file-${documentId}-${fileId}`;
    }

    private readonly getRoomFromConnection = (connection: ISocketConnection): string | undefined => {
        const id = connection.data['latexDocumentId'] as string | undefined;
        return id ? this.buildRoomId(id) : undefined;
    };

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
}

export default new LatexSocketModule(
    socketIOEmitter,
    socketIORoomManager,
    socketIOEventRegistry
);
