import { registerEventGroup } from '@shared/events/registerEventGroup';
import logger from '@shared/infrastructure/logger';

import AiEvents from '@modules/ai/events/AiEvents';
import AnalysisEvents from '@modules/analysis/events/AnalysisEvents';
import AuthEvents from '@modules/auth/events/AuthEvents';
import ChatEvents from '@modules/chat/events/ChatEvents';
import ClusterEvents from '@modules/cluster/events/ClusterEvents';
import ContainerEvents from '@modules/container/events/ContainerEvents';
import DailyActivityEvents from '@modules/daily-activity/events/DailyActivityEvents';
import JobsEvents from '@modules/jobs/events/JobsEvents';
import NotificationEvents from '@modules/notification/events/NotificationEvents';
import PluginEvents from '@modules/plugin/events/PluginEvents';
import ScriptingEvents from '@modules/scripting/events/ScriptingEvents';
import SessionEvents from '@modules/session/events/SessionEvents';
import SimulationCellEvents from '@modules/simulation-cell/events/SimulationCellEvents';
import TeamEvents from '@modules/team/events/TeamEvents';
import TrajectoryEvents from '@modules/trajectory/events/TrajectoryEvents';
import WhiteboardEvents from '@modules/whiteboards/events/WhiteboardEvents';

type EventGroupClass = new () => object;

/**
 * Every module's event surface, registered explicitly. Subscriptions are not a
 * side effect of importing a handler file, so the wiring is greppable here.
 */
const EVENT_GROUPS: Readonly<Record<string, readonly EventGroupClass[]>> = {
    ai: [AiEvents],
    analysis: [AnalysisEvents],
    auth: [AuthEvents],
    chat: [ChatEvents],
    cluster: [ClusterEvents],
    container: [ContainerEvents],
    'daily-activity': [DailyActivityEvents],
    jobs: [JobsEvents],
    notification: [NotificationEvents],
    plugin: [PluginEvents],
    scripting: [ScriptingEvents],
    session: [SessionEvents],
    'simulation-cell': [SimulationCellEvents],
    team: [TeamEvents],
    trajectory: [TrajectoryEvents],
    whiteboards: [WhiteboardEvents]
};

const mountEventGroups = (): void => {
    const groups = Object.values(EVENT_GROUPS).flat();

    for (const group of groups) {
        registerEventGroup(group);
    }

    logger.info(`@event-groups: registered ${groups.length} groups`);
};

export default mountEventGroups;
