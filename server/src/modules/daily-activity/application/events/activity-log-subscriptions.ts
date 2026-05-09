import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import { subscribeHandlerClass } from '@shared/infrastructure/events/Subscribe';
import { container, injectable } from 'tsyringe';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

type DailyActivityPayload = {
    teamId: string;
    userId: string;
};

interface DailyActivityLogOptions<TPayload extends DailyActivityPayload> {
    eventName: string;
    activityType: ActivityType;
    className: string;
    description: (payload: TPayload) => string;
}

const registerDailyActivityLog = <TPayload extends DailyActivityPayload>({
    eventName,
    activityType,
    className,
    description
}: DailyActivityLogOptions<TPayload>): void => {
    @injectable()
    class DailyActivityLogHandler implements IEventHandler<IDomainEvent<TPayload>> {
        private readonly activityRepo = container.resolve(DailyActivityRepository);

        async handle(event: IDomainEvent<TPayload>): Promise<void> {
            const { teamId, userId } = event.payload;
            await this.activityRepo.addDailyActivity(
                teamId,
                userId,
                activityType,
                description(event.payload)
            );
        }
    }

    Object.defineProperty(DailyActivityLogHandler, 'name', { value: className, configurable: true });
    subscribeHandlerClass(eventName, DailyActivityLogHandler as unknown as new () => IEventHandler<IDomainEvent>);
};

registerDailyActivityLog<DailyActivityPayload & { pluginDisplayName: string }>({
    eventName: 'analysis.deleted',
    activityType: ActivityType.AnalysisDeletion,
    className: 'AnalysisDeletedActivityLogHandler',
    description: ({ pluginDisplayName }) => `Deleted analysis "${pluginDisplayName}"`
});

registerDailyActivityLog<DailyActivityPayload & { name: string }>({
    eventName: 'container.created',
    activityType: ActivityType.ContainerCreation,
    className: 'ContainerCreatedActivityLogHandler',
    description: ({ name }) => `Created Docker container "${name}"`
});

registerDailyActivityLog<DailyActivityPayload & { containerName: string }>({
    eventName: 'container.deleted',
    activityType: ActivityType.ContainerDeletion,
    className: 'ContainerDeletedActivityLogHandler',
    description: ({ containerName }) => `Deleted Docker container "${containerName}"`
});

registerDailyActivityLog<DailyActivityPayload & { documentTitle: string }>({
    eventName: 'latex-document.created',
    activityType: ActivityType.LatexDocumentCreation,
    className: 'LatexDocumentCreatedActivityLogHandler',
    description: ({ documentTitle }) => `Created LaTeX document "${documentTitle}"`
});

registerDailyActivityLog<DailyActivityPayload & { documentTitle: string }>({
    eventName: 'latex-document.deleted',
    activityType: ActivityType.LatexDocumentDeletion,
    className: 'LatexDocumentDeletedActivityLogHandler',
    description: ({ documentTitle }) => `Deleted LaTeX document "${documentTitle}"`
});

registerDailyActivityLog<DailyActivityPayload & { pluginName: string; trajectoryName: string }>({
    eventName: 'PluginExecutionRequest',
    activityType: ActivityType.AnalysisPerformed,
    className: 'PluginExecutionRequestActivityLogHandler',
    description: ({ pluginName, trajectoryName }) => `started analysis on ${pluginName} for trajectory ${trajectoryName}`
});

registerDailyActivityLog<DailyActivityPayload & { name: string }>({
    eventName: 'team-role.created',
    activityType: ActivityType.RoleCreation,
    className: 'RoleCreatedActivityLogHandler',
    description: ({ name }) => `Created role "${name}"`
});

registerDailyActivityLog<DailyActivityPayload & { roleName: string }>({
    eventName: 'team-role.deleted',
    activityType: ActivityType.RoleDeletion,
    className: 'RoleDeletedActivityLogHandler',
    description: ({ roleName }) => `Deleted role "${roleName}"`
});

registerDailyActivityLog<DailyActivityPayload & { name: string }>({
    eventName: 'secret-key.created',
    activityType: ActivityType.SecretKeyCreation,
    className: 'SecretKeyCreatedActivityLogHandler',
    description: ({ name }) => `Created secret key "${name}"`
});

registerDailyActivityLog<DailyActivityPayload & { secretKeyName: string }>({
    eventName: 'secret-key.deleted',
    activityType: ActivityType.SecretKeyDeletion,
    className: 'SecretKeyDeletedActivityLogHandler',
    description: ({ secretKeyName }) => `Deleted secret key "${secretKeyName}"`
});

registerDailyActivityLog<DailyActivityPayload & { trajectoryName: string }>({
    eventName: 'trajectory.created',
    activityType: ActivityType.TrajectoryUpload,
    className: 'TrajectoryCreatedActivityLogHandler',
    description: ({ trajectoryName }) => `Uploaded trajectory "${trajectoryName}"`
});

registerDailyActivityLog<DailyActivityPayload & { trajectoryName: string }>({
    eventName: 'trajectory.deleted',
    activityType: ActivityType.TrajectoryDeletion,
    className: 'TrajectoryDeletedActivityLogHandler',
    description: ({ trajectoryName }) => `Deleted trajectory "${trajectoryName}"`
});

registerDailyActivityLog<DailyActivityPayload & { whiteboardTitle: string }>({
    eventName: 'whiteboard.created',
    activityType: ActivityType.WhiteboardCreation,
    className: 'WhiteboardCreatedActivityLogHandler',
    description: ({ whiteboardTitle }) => `Created whiteboard "${whiteboardTitle}"`
});

registerDailyActivityLog<DailyActivityPayload & { whiteboardTitle: string }>({
    eventName: 'whiteboard.deleted',
    activityType: ActivityType.WhiteboardDeletion,
    className: 'WhiteboardDeletedActivityLogHandler',
    description: ({ whiteboardTitle }) => `Deleted whiteboard "${whiteboardTitle}"`
});
