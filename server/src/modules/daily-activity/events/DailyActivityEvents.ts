import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { ActivityType } from '@volt/contracts/modules/daily-activity/domain';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import logger from '@shared/infrastructure/logger';

@DefineEventGroup('daily-activity')
export default class DailyActivityEvents {
    #service = new DailyActivityService();

    @Event('analysis.deleted')
    async analysisDeleted({ teamId, userId, pluginDisplayName }: EventMap['analysis.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.AnalysisDeletion, `Deleted analysis "${pluginDisplayName}"`);
    }

    @Event('container.created')
    async containerCreated({ teamId, userId, name }: EventMap['container.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.ContainerCreation, `Created Docker container "${name}"`);
    }

    @Event('container.deleted')
    async containerDeleted({ teamId, userId, containerName }: EventMap['container.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.ContainerDeletion, `Deleted Docker container "${containerName}"`);
    }

    @Event('latex-document.created')
    async latexDocumentCreated({ teamId, userId, documentTitle }: EventMap['latex-document.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.LatexDocumentCreation, `Created LaTeX document "${documentTitle}"`);
    }

    @Event('latex-document.deleted')
    async latexDocumentDeleted({ teamId, userId, documentTitle }: EventMap['latex-document.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.LatexDocumentDeletion, `Deleted LaTeX document "${documentTitle}"`);
    }

    @Event('PluginExecutionRequest')
    async pluginExecutionRequested({ teamId, userId, pluginName, trajectoryName }: EventMap['PluginExecutionRequest']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.AnalysisPerformed, `started analysis on ${pluginName} for trajectory ${trajectoryName}`);
    }

    @Event('team-role.created')
    async teamRoleCreated({ teamId, userId, name }: EventMap['team-role.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.RoleCreation, `Created role "${name}"`);
    }

    @Event('team-role.deleted')
    async teamRoleDeleted({ teamId, userId, roleName }: EventMap['team-role.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.RoleDeletion, `Deleted role "${roleName}"`);
    }

    @Event('secret-key.created')
    async secretKeyCreated({ teamId, userId, name }: EventMap['secret-key.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.SecretKeyCreation, `Created secret key "${name}"`);
    }

    @Event('secret-key.deleted')
    async secretKeyDeleted({ teamId, userId, secretKeyName }: EventMap['secret-key.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.SecretKeyDeletion, `Deleted secret key "${secretKeyName}"`);
    }

    @Event('trajectory.created')
    async trajectoryCreated({ teamId, userId, trajectoryName }: EventMap['trajectory.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.TrajectoryUpload, `Uploaded trajectory "${trajectoryName}"`);
    }

    @Event('trajectory.deleted')
    async trajectoryDeleted({ teamId, userId, trajectoryName }: EventMap['trajectory.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.TrajectoryDeletion, `Deleted trajectory "${trajectoryName}"`);
    }

    @Event('whiteboard.created')
    async whiteboardCreated({ teamId, userId, whiteboardTitle }: EventMap['whiteboard.created']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.WhiteboardCreation, `Created whiteboard "${whiteboardTitle}"`);
    }

    @Event('whiteboard.deleted')
    async whiteboardDeleted({ teamId, userId, whiteboardTitle }: EventMap['whiteboard.deleted']) {
        await this.#service.recordActivity(teamId, userId, ActivityType.WhiteboardDeletion, `Deleted whiteboard "${whiteboardTitle}"`);
    }

    @Event('team.deleted')
    async deleteTeamActivity({ teamId }: EventMap['team.deleted']) {
        await DailyActivity.delete({ team: teamId });
    }

    @Event('user.deleted')
    async deleteUserActivity({ userId }: EventMap['user.deleted']) {
        await DailyActivity.delete({ user: userId });
    }

    @Event('user-activity.recorded')
    async userActivityRecorded({ teamId, userId, minutes }: EventMap['user-activity.recorded']) {
        try {
            await this.#service.recordOnlineMinutes(teamId, userId, minutes);
        } catch (error) {
            logger.error(error, `[DailyActivityEvents] Failed to update activity for user ${userId}`);
        }
    }
}
