import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type { ContainerTerminalAttachment, ContainerTerminalSize } from '@shared/contracts/ports/IContainerService';
import logger from '@shared/infrastructure/logger';

/* One PTY per container, shared by every socket watching it.
 *
 * A terminal is a single daemon-side exec session, so a second viewer must join
 * the existing stream rather than open a new one. Joining late replays a capped
 * transcript so the newcomer sees the scrollback, and because attach, resize,
 * join and teardown all mutate the same session they are serialized through a
 * per-session promise chain. */

const TRANSCRIPT_REPLAY_BYTE_CAP = 512 * 1024;

export const CONTAINER_TERMINAL_EVENTS = {
    ATTACH: 'container:terminal:attach',
    DETACH: 'container:terminal:detach',
    DATA: 'container:terminal:data',
    INPUT: 'container:terminal:input',
    RESIZE: 'container:terminal:resize',
    SIZE: 'container:terminal:size',
    ERROR: 'container:error'
} as const;

interface SharedTerminalSession {
    readonly attachment: ContainerTerminalAttachment;
    readonly containerKey: string;
    readonly participants: Set<string>;
    readonly transcriptChunks: string[];
    closing: boolean;
    currentSize: ContainerTerminalSize | null;
    operationChain: Promise<void>;
    transcriptBytes: number;
}

export class ContainerTerminalSessionRegistry {
    private readonly pendingSessionsByContainerKey = new Map<string, Promise<SharedTerminalSession>>();
    private readonly sharedSessionsByContainerKey = new Map<string, SharedTerminalSession>();
    private readonly socketMemberships = new Map<string, string>();

    async acquire(teamClusterId: string, runtimeContainerId: string): Promise<SharedTerminalSession> {
        const containerKey = `${teamClusterId}:${runtimeContainerId}`;
        const existingSession = this.sharedSessionsByContainerKey.get(containerKey);
        if (existingSession) {
            return existingSession;
        }

        const pendingSession = this.pendingSessionsByContainerKey.get(containerKey);
        if (pendingSession) {
            return pendingSession;
        }

        const sessionPromise = daemonContainerRuntimeService.attachTerminal(teamClusterId, runtimeContainerId)
            .then((attachment) => {
                const session = this.createSession(containerKey, attachment);
                this.sharedSessionsByContainerKey.set(containerKey, session);
                return session;
            })
            .finally(() => {
                this.pendingSessionsByContainerKey.delete(containerKey);
            });

        this.pendingSessionsByContainerKey.set(containerKey, sessionPromise);
        return sessionPromise;
    }

    async addParticipant(session: SharedTerminalSession, socketId: string): Promise<void> {
        this.socketMemberships.set(socketId, session.containerKey);

        await this.runSessionTask(session, async () => {
            if (session.closing) {
                return;
            }

            const transcript = session.transcriptChunks.join('');
            const size = session.currentSize;

            if (size) {
                socketIOEmitter.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.SIZE, size);
            }

            if (transcript.length > 0) {
                socketIOEmitter.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.DATA, transcript);
            }

            session.participants.add(socketId);
        });
    }

    async removeParticipant(socketId: string): Promise<void> {
        const containerKey = this.socketMemberships.get(socketId);
        if (!containerKey) {
            return;
        }

        this.socketMemberships.delete(socketId);
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session) {
            return;
        }

        await this.runSessionTask(session, async () => {
            session.participants.delete(socketId);
        });

        await this.releaseIfUnused(containerKey);
    }

    async releaseIfUnused(containerKey: string): Promise<void> {
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session) {
            return;
        }

        await this.runSessionTask(session, async () => {
            if (session.participants.size > 0 || session.closing) {
                return;
            }

            await this.closeSession(session);
        });
    }

    getSessionBySocketId(socketId: string): SharedTerminalSession | null {
        const containerKey = this.socketMemberships.get(socketId);
        if (!containerKey) {
            return null;
        }

        return this.sharedSessionsByContainerKey.get(containerKey) ?? null;
    }

    writeInput(socketId: string, data: string): void {
        const session = this.getSessionBySocketId(socketId);
        if (!session || session.closing || session.attachment.stream.destroyed) {
            return;
        }

        session.attachment.stream.write(data);
    }

    async resize(session: SharedTerminalSession, size: ContainerTerminalSize): Promise<void> {
        await this.runSessionTask(session, async () => {
            if (session.closing) {
                return;
            }

            try {
                await session.attachment.exec.resize(size);
            } catch (error) {
                logger.warn(
                    `[ContainerTerminalSocket] Resize failed containerKey=${session.containerKey} rows=${size.rows} cols=${size.cols} error=${error instanceof Error ? error.message : String(error)}`
                );
                return;
            }

            session.currentSize = size;
            this.broadcast(session, CONTAINER_TERMINAL_EVENTS.SIZE, size);
        });
    }

    emitError(socketId: string, code: string, message: string): void {
        socketIOEmitter.emitToSocket(socketId, CONTAINER_TERMINAL_EVENTS.ERROR, {
            code,
            message
        });
    }

    private broadcast(session: SharedTerminalSession, event: string, payload: unknown): void {
        for (const participantSocketId of session.participants) {
            socketIOEmitter.emitToSocket(participantSocketId, event, payload);
        }
    }

    private createSession(containerKey: string, attachment: ContainerTerminalAttachment): SharedTerminalSession {
        const session: SharedTerminalSession = {
            attachment,
            containerKey,
            participants: new Set<string>(),
            transcriptChunks: [],
            transcriptBytes: 0,
            currentSize: null,
            operationChain: Promise.resolve(),
            closing: false
        };

        attachment.stream.on('data', (chunk: Buffer) => {
            const data = chunk.toString('utf8');
            session.transcriptChunks.push(data);
            session.transcriptBytes += chunk.length;

            while (session.transcriptBytes > TRANSCRIPT_REPLAY_BYTE_CAP && session.transcriptChunks.length > 1) {
                const evicted = session.transcriptChunks.shift() as string;
                session.transcriptBytes -= Buffer.byteLength(evicted, 'utf8');
            }

            this.broadcast(session, CONTAINER_TERMINAL_EVENTS.DATA, data);
        });
        attachment.stream.on('end', () => this.handleSessionTermination(containerKey));
        attachment.stream.on('error', (error: Error) => this.handleSessionTermination(containerKey, error));

        return session;
    }

    private handleSessionTermination(containerKey: string, error?: Error): void {
        const session = this.sharedSessionsByContainerKey.get(containerKey);
        if (!session || session.closing) {
            return;
        }

        void this.runSessionTask(session, () => this.closeSession(session, error)).catch((closeError) => {
            logger.warn(
                `[ContainerTerminalSocket] Session close failed containerKey=${containerKey} error=${closeError instanceof Error ? closeError.message : String(closeError)}`
            );
        });
    }

    private async closeSession(session: SharedTerminalSession, error?: Error): Promise<void> {
        if (session.closing) {
            return;
        }

        session.closing = true;
        this.sharedSessionsByContainerKey.delete(session.containerKey);
        session.attachment.stream.removeAllListeners();

        const participantSocketIds = Array.from(session.participants);
        session.participants.clear();
        session.transcriptChunks.length = 0;
        session.transcriptBytes = 0;
        session.currentSize = null;

        for (const participantSocketId of participantSocketIds) {
            if (this.socketMemberships.get(participantSocketId) === session.containerKey) {
                this.socketMemberships.delete(participantSocketId);
            }

            if (error) {
                this.emitError(participantSocketId, 'STREAM_ERROR', error.message);
            }
        }

        try {
            await session.attachment.close();
        } catch (closeError) {
            logger.warn(
                `[ContainerTerminalSocket] Terminal close failed containerKey=${session.containerKey} error=${closeError instanceof Error ? closeError.message : String(closeError)}`
            );
        }
    }

    /** Serializes every mutation of one session so joins never interleave with teardown. */
    private async runSessionTask(session: SharedTerminalSession, task: () => Promise<void>): Promise<void> {
        const previousOperation = session.operationChain.catch(() => undefined);
        let releaseOperation: () => void = () => undefined;
        session.operationChain = new Promise<void>((resolve) => {
            releaseOperation = resolve;
        });

        await previousOperation;

        try {
            return await task();
        } finally {
            releaseOperation();
        }
    }
}
