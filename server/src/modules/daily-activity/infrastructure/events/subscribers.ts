import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/daily-activity/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/daily-activity/application/events/UserDeletedEventHandler';
import LogPluginExecutionRequestHandler from '@modules/daily-activity/application/events/LogPluginExecutionRequestHandler';
import TrajectoryCreatedEventHandler from '@modules/daily-activity/application/events/TrajectoryCreatedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/daily-activity/application/events/TrajectoryDeletedEventHandler';
import AnalysisDeletedEventHandler from '@modules/daily-activity/application/events/AnalysisDeletedEventHandler';
import LatexDocumentCreatedEventHandler from '@modules/daily-activity/application/events/LatexDocumentCreatedEventHandler';
import LatexDocumentDeletedEventHandler from '@modules/daily-activity/application/events/LatexDocumentDeletedEventHandler';
import ContainerCreatedEventHandler from '@modules/daily-activity/application/events/ContainerCreatedEventHandler';
import ContainerDeletedEventHandler from '@modules/daily-activity/application/events/ContainerDeletedEventHandler';
import WhiteboardCreatedEventHandler from '@modules/daily-activity/application/events/WhiteboardCreatedEventHandler';
import WhiteboardDeletedEventHandler from '@modules/daily-activity/application/events/WhiteboardDeletedEventHandler';
import RoleCreatedEventHandler from '@modules/daily-activity/application/events/RoleCreatedEventHandler';
import RoleDeletedEventHandler from '@modules/daily-activity/application/events/RoleDeletedEventHandler';
import SecretKeyCreatedEventHandler from '@modules/daily-activity/application/events/SecretKeyCreatedEventHandler';
import SecretKeyDeletedEventHandler from '@modules/daily-activity/application/events/SecretKeyDeletedEventHandler';

export const dailyActivitySubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler,
    'PluginExecutionRequest': LogPluginExecutionRequestHandler,
    'trajectory.created': TrajectoryCreatedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler,
    'analysis.deleted': AnalysisDeletedEventHandler,
    'latex-document.created': LatexDocumentCreatedEventHandler,
    'latex-document.deleted': LatexDocumentDeletedEventHandler,
    'container.created': ContainerCreatedEventHandler,
    'container.deleted': ContainerDeletedEventHandler,
    'whiteboard.created': WhiteboardCreatedEventHandler,
    'whiteboard.deleted': WhiteboardDeletedEventHandler,
    'team-role.created': RoleCreatedEventHandler,
    'team-role.deleted': RoleDeletedEventHandler,
    'secret-key.created': SecretKeyCreatedEventHandler,
    'secret-key.deleted': SecretKeyDeletedEventHandler
};
