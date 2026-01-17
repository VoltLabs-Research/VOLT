import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@/src/modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { SOCKET_TOKENS } from '@/src/modules/socket/infrastructure/di/SocketTokens';
import { TEAM_TOKENS } from '../di/TeamTokens';
import TeamJobsService from './TeamJobsService';
import logger from '@/src/shared/infrastructure/logger';

@singleton()
export default class TeamJobsSocketModule extends BaseSocketModule {
    public readonly name = 'TeamJobsSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any,
        @inject(TEAM_TOKENS.TeamJobsService) private readonly teamJobsService: TeamJobsService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[TeamJobsSocketModule] Initialized');
    }

    onConnection(connection: ISocketConnection): void {
        this.on(connection.id, 'subscribe_to_team', async (conn, payload: { teamId: string; previousTeamId?: string }) => {
            const { teamId, previousTeamId } = payload;
            const teamRoom = `team:${teamId}`;

            // Leave previous team room if provided
            if (previousTeamId) {
                const previousRoom = `team:${previousTeamId}`;
                await this.leaveRoom(conn.id, previousRoom);
                logger.debug(`[TeamJobsSocketModule] Left previous team room: ${previousRoom}`);
            }

            // Join new team room
            await this.joinRoom(conn.id, teamRoom);
            logger.info(`[TeamJobsSocketModule] Connection ${conn.id} joined team room: ${teamRoom}`);

            // Fetch and send active jobs for this team
            try {
                const groupedJobs = await this.teamJobsService.getTeamJobs(teamId);
                this.emitToSocket(conn.id, 'team.jobs.initial', groupedJobs);
                logger.debug(`[TeamJobsSocketModule] Sent ${groupedJobs.length} job groups to connection ${conn.id}`);
            } catch (error) {
                logger.error(error, `[TeamJobsSocketModule] Failed to fetch jobs for team ${teamId}`);
            }
        });

        this.on(connection.id, 'disconnect', async () => {
            logger.debug(`[TeamJobsSocketModule] Connection ${connection.id} disconnected`);
        });
    }
}
