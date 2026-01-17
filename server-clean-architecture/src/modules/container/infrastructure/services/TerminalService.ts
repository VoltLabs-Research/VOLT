import { injectable, inject } from 'tsyringe';
import { Socket } from 'socket.io';
import { ITerminalService } from '../../domain/ports/ITerminalService';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import { IContainerService } from '../../domain/ports/IContainerService';
import logger from '@/src/shared/infrastructure/logger';

interface TerminalSession {
    stream: any;
    exec: any;
    history: Buffer[];
    historySize: number;
    activeConnections: number;
    cleanupTimer: NodeJS.Timeout | null;
}

@injectable()
export class TerminalService implements ITerminalService {
    private sessions: Map<string, TerminalSession> = new Map();
    private readonly HISTORY_LIMIT_BYTES = 10000;

    constructor(
        @inject('IContainerService') private containerService: IContainerService,
        @inject('IContainerRepository') private repository: IContainerRepository
    ) { }

    handleConnection(socket: Socket): void {
        socket.on('container:terminal:attach', async (data: { containerId: string }) => {
            await this.attach(socket, data.containerId);
        });
    }

    async attach(socket: Socket, containerId: string): Promise<void> {
        socket.join(containerId);
        let session = this.sessions.get(containerId);

        if (!session) {
            try {
                // Find container via Repository to get Docker ID
                const containerDoc = await this.repository.findById(containerId);
                if (!containerDoc || !containerDoc.containerId) {
                    socket.emit('container:error', 'Container not found only or not created');
                    return;
                }

                const { stream, exec } = await this.containerService.attachTerminal(containerDoc.containerId);
                session = {
                    stream,
                    exec,
                    history: [],
                    historySize: 0,
                    activeConnections: 0,
                    cleanupTimer: null
                };

                this.sessions.set(containerId, session);

                stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf-8');
                    socket.nsp.to(containerId).emit('container:terminal:data', data);
                    if (session) {
                        session.history.push(chunk);
                        session.historySize += chunk.length;
                        while (session.historySize > this.HISTORY_LIMIT_BYTES && session.history.length > 0) {
                            const removed = session.history.shift();
                            if (removed) session.historySize -= removed.length;
                        }
                    }
                });

                stream.on('end', () => this.cleanupSession(containerId));
                stream.on('error', (err: any) => {
                    socket.nsp.to(containerId).emit('container:error', 'Stream error: ' + err.message);
                    this.cleanupSession(containerId);
                });

            } catch (error: any) {
                socket.emit('container:error', error.message);
                socket.leave(containerId);
                return;
            }
        }

        if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        session.activeConnections++;
        if (session.history.length > 0) {
            const combined = Buffer.concat(session.history).toString('utf8');
            socket.emit('container:terminal:data', combined);
        }

        // Setup listeners
        const onInput = (input: string) => {
            if (session && session.stream && !session.stream.destroyed) {
                session.stream.write(input);
            }
        };

        const onResize = (size: { rows: number, cols: number }) => {
            if (session && session.exec) {
                session.exec.resize(size).catch(() => { });
            }
        };

        const onDisconnect = () => this.detach(socket, containerId);

        // Store handlers on socket for cleanup
        (socket as any)._termHandlers = { onInput, onResize, onDisconnect };

        socket.on('container:terminal:input', onInput);
        socket.on('container:terminal:resize', onResize);
        socket.on('container:terminal:detach', onDisconnect);
        socket.on('disconnect', onDisconnect);
    }

    detach(socket: Socket, containerId: string): void {
        const handlers = (socket as any)._termHandlers;
        if (handlers) {
            socket.off('container:terminal:input', handlers.onInput);
            socket.off('container:terminal:resize', handlers.onResize);
            socket.off('container:terminal:detach', handlers.onDisconnect);
            socket.off('disconnect', handlers.onDisconnect);
            delete (socket as any)._termHandlers;
        }
        socket.leave(containerId);

        const session = this.sessions.get(containerId);
        if (!session) return;

        session.activeConnections--;
        if (session.activeConnections <= 0) {
            session.activeConnections = 0;
            session.cleanupTimer = setTimeout(() => this.cleanupSession(containerId), 5000);
        }
    }

    private cleanupSession(containerId: string) {
        const session = this.sessions.get(containerId);
        if (!session || session.activeConnections > 0) return;

        try {
            session.stream.removeAllListeners();
            session.stream.destroy();
            session.exec = null;
            session.history = [];
        } catch (e) {
            logger.error(`Error cleaning up session ${containerId}: ${e}`);
        }
        this.sessions.delete(containerId);
    }
}
