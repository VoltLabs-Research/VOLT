import { ErrorCodes } from '@core/constants/error-codes';
import type { ContainerTerminalSize } from '@shared/contracts/ports/IContainerService';
import Container from '@modules/container/models/Container';
import { CONTAINER_TERMINAL_EVENTS, ContainerTerminalSessionRegistry } from '@modules/container/socket/ContainerTerminalSessionRegistry';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import logger from '@shared/infrastructure/logger';

/* Socket wiring for container terminals: authorize the attach, then hand the
 * socket to the shared session registry. Sessions outlive individual sockets,
 * so an attach that is superseded while the daemon is still connecting has to
 * be detected and undone — that is what the attach token guards. */

interface ContainerTerminalAttachPayload {
    containerId: string;
}

class ContainerTerminalSocketModule extends BaseSocketModule {
    public readonly name = 'ContainerTerminalSocketModule';

    private readonly pendingAttachTokens = new Map<string, number>();
    private readonly pendingResizeBySocketId = new Map<string, ContainerTerminalSize>();
    private readonly sessions = new ContainerTerminalSessionRegistry();
    private attachTokenSeed = 0;

    onConnection(connection: ISocketConnection): void {
        this.on<ContainerTerminalAttachPayload>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.ATTACH,
            async (conn, payload) => {
                await this.handleAttach(conn, payload);
            }
        );

        this.on<unknown>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.DETACH,
            async (conn) => {
                await this.cleanupSocket(conn.id);
            }
        );

        this.on<string>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.INPUT,
            async (conn, data) => {
                this.sessions.writeInput(conn.id, data);
            }
        );

        this.on<ContainerTerminalSize>(
            connection.id,
            CONTAINER_TERMINAL_EVENTS.RESIZE,
            async (conn, size) => {
                const session = this.sessions.getSessionBySocketId(conn.id);
                if (!session || session.closing) {
                    this.pendingResizeBySocketId.set(conn.id, size);
                    return;
                }

                await this.sessions.resize(session, size);
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            await this.cleanupSocket(conn.id);
        });
    }

    private async handleAttach(conn: ISocketConnection, payload: ContainerTerminalAttachPayload): Promise<void> {
        await this.cleanupSocket(conn.id);

        this.attachTokenSeed += 1;
        const attachToken = this.attachTokenSeed;
        this.pendingAttachTokens.set(conn.id, attachToken);

        try {
            const container = await Container.findOneBy({ id: payload.containerId });
            if(!container){
                this.sessions.emitError(conn.id, 'CONTAINER_NOT_FOUND', 'Container not found');
                return;
            }

            const userTeams = new Set(conn.user?.teams ?? []);
            const containerTeamId = container.team ?? undefined;
            if(!containerTeamId || !userTeams.has(containerTeamId)){
                this.sessions.emitError(conn.id, ErrorCodes.TEAM_ACCESS_DENIED, 'You do not have access to this container');
                return;
            }

            if(!container.teamCluster){
                this.sessions.emitError(conn.id, 'NO_CLUSTER', 'Container is not assigned to a cluster');
                return;
            }

            const session = await this.sessions.acquire(container.teamCluster, container.containerId);

            if (this.pendingAttachTokens.get(conn.id) !== attachToken || session.closing) {
                await this.sessions.releaseIfUnused(session.containerKey);
                return;
            }

            await this.sessions.addParticipant(session, conn.id);

            if (
                this.pendingAttachTokens.get(conn.id) !== attachToken
                || this.sessions.getSessionBySocketId(conn.id) !== session
                || session.closing
            ) {
                await this.cleanupSocket(conn.id);
                return;
            }

            const pendingSize = this.pendingResizeBySocketId.get(conn.id);
            if (pendingSize) {
                this.pendingResizeBySocketId.delete(conn.id);
                await this.sessions.resize(session, pendingSize);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to attach terminal';
            logger.warn(`[ContainerTerminalSocket] Attach failed containerId=${payload.containerId} socketId=${conn.id} error=${message}`);
            this.sessions.emitError(conn.id, 'ATTACH_FAILED', message);
        } finally {
            this.pendingAttachTokens.delete(conn.id);
        }
    }

    private async cleanupSocket(socketId: string): Promise<void> {
        this.pendingAttachTokens.delete(socketId);
        this.pendingResizeBySocketId.delete(socketId);
        await this.sessions.removeParticipant(socketId);
    }
}

export default new ContainerTerminalSocketModule(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
