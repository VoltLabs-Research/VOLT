import TeamJobProjectedEvent from '@modules/jobs/domain/events/TeamJobProjectedEvent';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class TeamJobProjectedEventHandler implements IEventHandler<TeamJobProjectedEvent> {
    constructor(
        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter,

        @inject(TEAM_TOKENS.TeamJobsService)
        private readonly teamJobsService: TeamJobsService
    ){}

    async handle(event: TeamJobProjectedEvent): Promise<void> {
        const { teamId, jobId, status, queueType, metadata, timestamp, trajectoryId, trajectoryName, timestep, message, analysisId, revision } = event.payload;

        this.teamJobsService.invalidateInitialTeamJobs(teamId);

        await this.socketEmitter.emitToRoom(
            `team:${teamId}`,
            'team.job.updated',
            {
                ...metadata,
                jobId,
                status,
                queueType,
                name: event.payload.name ?? metadata?.name,
                timestamp: timestamp ?? new Date().toISOString(),
                trajectoryId: trajectoryId ?? metadata?.trajectoryId,
                trajectoryName: trajectoryName ?? metadata?.trajectoryName,
                timestep: timestep ?? metadata?.timestep,
                message: message ?? metadata?.message,
                error: metadata?.error,
                analysisId: analysisId ?? metadata?.analysisId,
                revision,
                teamId
            }
        );
    }
}
