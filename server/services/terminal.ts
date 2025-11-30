import { Socket } from 'socket.io';
import { dockerService } from './docker';
import { Container } from '@/models/index';

interface TerminalSession {
    stream: any;
    exec: any;
    history: string;
    sockets: Set<Socket>;
    cleanupTimer: NodeJS.Timeout | null;
}

class TerminalManager {
    private sessions: Map<string, TerminalSession> = new Map();
    private readonly HISTORY_LIMIT = 10000; // Keep last 10KB of history

    async attach(socket: Socket, containerId: string) {
        let session = this.sessions.get(containerId);

        if (!session) {
            // Create new session
            try {
                const containerDoc = await Container.findById(containerId);
                if (!containerDoc) {
                    socket.emit('container:error', 'Container not found');
                    return;
                }

                const container = dockerService.getContainer(containerDoc.containerId);

                const exec = await container.exec({
                    AttachStdin: true,
                    AttachStdout: true,
                    AttachStderr: true,
                    Tty: true,
                    Cmd: ['/bin/sh'],
                    Env: ['TERM=xterm-256color']
                });

                const stream = await exec.start({ hijack: true, stdin: true });

                session = {
                    stream,
                    exec,
                    history: '',
                    sockets: new Set(),
                    cleanupTimer: null
                };

                this.sessions.set(containerId, session);

                // Handle PTY output
                stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf8');

                    // Update history
                    session!.history += data;
                    if (session!.history.length > this.HISTORY_LIMIT) {
                        session!.history = session!.history.slice(-this.HISTORY_LIMIT);
                    }

                    // Broadcast to all connected sockets
                    session!.sockets.forEach(s => {
                        s.emit('container:terminal:data', data);
                    });
                });

                stream.on('end', () => {
                    this.cleanupSession(containerId);
                });

            } catch (error: any) {
                socket.emit('container:error', error.message);
                return;
            }
        }

        // Add socket to session
        if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        session.sockets.add(socket);

        // Send history to new client
        if (session.history) {
            socket.emit('container:terminal:data', session.history);
        }

        // Handle socket input
        const onInput = (input: string) => {
            if (session && session.stream) {
                session.stream.write(input);
            }
        };

        const onResize = (size: { rows: number, cols: number }) => {
            if (session && session.exec) {
                session.exec.resize(size);
            }
        };

        const onDisconnect = () => {
            this.detach(socket, containerId);
        };

        socket.on('container:terminal:input', onInput);
        socket.on('container:terminal:resize', onResize);
        socket.on('container:terminal:detach', onDisconnect);
        socket.on('disconnect', onDisconnect);

        // Store cleanup function on socket to remove listeners later if needed
        (socket as any)._terminalCleanup = () => {
            socket.off('container:terminal:input', onInput);
            socket.off('container:terminal:resize', onResize);
            socket.off('container:terminal:detach', onDisconnect);
            socket.off('disconnect', onDisconnect);
        };
    }

    detach(socket: Socket, containerId: string) {
        const session = this.sessions.get(containerId);
        if (!session) return;

        session.sockets.delete(socket);

        // Clean up socket listeners
        if ((socket as any)._terminalCleanup) {
            (socket as any)._terminalCleanup();
            delete (socket as any)._terminalCleanup;
        }

        if (session.sockets.size === 0) {
            // Schedule session cleanup
            session.cleanupTimer = setTimeout(() => {
                this.cleanupSession(containerId);
            }, 5000); // 5 seconds grace period
        }
    }

    private cleanupSession(containerId: string) {
        const session = this.sessions.get(containerId);
        if (!session) return;

        // If sockets reconnected during grace period, abort
        if (session.sockets.size > 0) return;

        try {
            session.stream.end();
        } catch (e) {
            // Ignore
        }

        this.sessions.delete(containerId);
    }
}

export const terminalManager = new TerminalManager();
