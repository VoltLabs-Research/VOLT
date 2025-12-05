import { Socket } from 'socket.io';
import { dockerService } from '@/services/docker';
import { Container } from '@/models';

export interface TerminalSession{
    stream: any;
    exec: any;
    history: Buffer[];
    historySize: number;
    activeConnections: number;
    cleanupTimer: NodeJS.Timeout | null;
};

class TerminalManager{
    private sessions: Map<string, TerminalSession> = new Map();
    private readonly HISTORY_LIMIT_BYTES = 10000;

    async attach(socket: Socket, containerId: string){
        socket.join(containerId);
        let session = this.sessions.get(containerId);

        if(!session){
            try{
                const containerDoc = await Container.findById(containerId);
                if(!containerDoc){
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
                    history: [],
                    historySize: 0,
                    activeConnections: 0,
                    cleanupTimer: null
                };

                this.sessions.set(containerId, session);
                stream.on('data', (chunk: Buffer) => {
                    const data = chunk.toString('utf-8');
                    socket.nsp.to(containerId).emit('container:terminal:data', data);
                    if(session){
                        session.history.push(chunk);
                        session.historySize += chunk.length;

                        while(session.historySize > this.HISTORY_LIMIT_BYTES && session.history.length > 0){
                            const removedChunk = session.history.shift();
                            if(removedChunk){
                                session.historySize -= removedChunk.length;
                            }
                        }
                    }
                });

                stream.on('end', () => {
                    this.cleanupSession(containerId);
                });

                stream.on('error', (err: any) => {
                    socket.nsp.to(containerId).emit('container:error', 'Stream error: ' + err.message);
                    this.cleanupSession(containerId);
                });
            }catch(error: any){
                socket.emit('container:error', error.message);
                socket.leave(containerId);
                return;  
            }
        }

        if(session.cleanupTimer){
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
        }

        session.activeConnections++;

        if(session.history.length > 0){
            const combinedHistory = Buffer.concat(session.history).toString('utf8');
            socket.emit('container:terminal:data', combinedHistory);
        }

        const onInput = (input: string) => {
            if(session && session.stream && !session.stream.destroyed){
                session.stream.write(input);
            }
        };

        const onResize = (size: { rows: number, cols: number }) => {
            if(session && session.exec){
                session.exec.resize(size).catch(() => {});
            }
        };

        const onDisconnect = () => {
            this.detach(socket, containerId);
        };

        socket.on('container:terminal:input', onInput);
        socket.on('container:terminal:resize', onResize);
        socket.on('container:terminal:detach', onDisconnect);
        socket.on('disconnect', onDisconnect);

        (socket as any)._terminalCleanup = () => {
            socket.off('container:terminal:input', onInput);
            socket.off('container:terminal:resize', onResize);
            socket.off('container:terminal:detach', onDisconnect);
            socket.off('disconnect', onDisconnect);
            socket.leave(containerId); 
        };
    }

    detach(socket: Socket, containerId: string){
        if((socket as any)._terminalCleanup){
            (socket as any)._terminalCleanup();
            delete (socket as any)._terminalCleanup;
        }

        const session = this.sessions.get(containerId);
        if(!session) return;

        session.activeConnections--;
        if(session.activeConnections <= 0){
            session.activeConnections = 0;
            session.cleanupTimer = setTimeout(() => {
                this.cleanupSession(containerId);
            }, 5000);
        }
    }

    private cleanupSession(containerId: string){
        const session = this.sessions.get(containerId);
        if(!session) return;
        if(session.activeConnections > 0) return;

        try{
            session.stream.removeAllListeners();
            session.stream.destroy();
            session.exec = null;
            session.history = [];
        }catch(e){
            console.error(`Error cleaning up session ${containerId}`, e);
        }
        this.sessions.delete(containerId);
    }
};

export const terminalManager = new TerminalManager();