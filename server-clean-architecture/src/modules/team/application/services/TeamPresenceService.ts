import { injectable, inject } from 'tsyringe';
import { ITeamPresenceService } from '@modules/team/domain/ports/ITeamPresenceService';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import logger from '@shared/infrastructure/logger';

interface ConnectionInfo {
    userId: string;
    teamIds: string[];
    startTime: number;
};

@injectable()
export default class TeamPresenceService implements ITeamPresenceService{
    private connectionTimes: Map<string, ConnectionInfo> = new Map();

    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private readonly dailyActivityRepository: IDailyActivityRepository
    ){}

    recordConnection(
        socketId: string, 
        userId: string, 
        teamIds: string[]
    ): void{
        this.connectionTimes.set(socketId, {
            userId,
            teamIds,
            startTime: Date.now()
        });
        logger.info(`@team-presence-service: recorded connection for user ${userId}`);
    }

    async recordDisconnection(socketId: string): Promise<void> {
        const connectionInfo = this.connectionTimes.get(socketId);
        if(!connectionInfo) return;

        const durationMinutes = (Date.now() - connectionInfo.startTime) / 1000 / 60;
        this.connectionTimes.delete(socketId);

        if(durationMinutes <= 0) return;

        await this.updateDailyActivityForTeams(
            connectionInfo.userId,
            connectionInfo.teamIds,
            Math.ceil(durationMinutes)
        );
        logger.info(`@team-presence-service: recorded ${Math.ceil(durationMinutes)} minutes for user ${connectionInfo.userId}`);
    }

    /**
     * Update daily activity records for all teams.
     * Uses bulk update via repository method that needs to be added.
     */
    private async updateDailyActivityForTeams(
        userId: string,
        teamIds: string[],
        minutesOnline: number
    ): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Update activity for each team using upsert
        await Promise.all(teamIds.map(teamId =>
            this.dailyActivityRepository.updateOnlineMinutes(
                teamId,
                userId,
                startOfDay,
                minutesOnline
            )
        ));
    }
}
