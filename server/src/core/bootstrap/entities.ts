import type { DatabaseEntities } from '@core/config/database';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import DomainEventSpoolEntry from '@shared/infrastructure/persistence/models/DomainEventSpoolEntry';
import KeyValueEntry from '@shared/infrastructure/persistence/models/KeyValueEntry';
import KeyValueSetMember from '@shared/infrastructure/persistence/models/KeyValueSetMember';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import Analysis from '@modules/analysis/models/Analysis';
import AnalysisProvenance from '@modules/analysis/models/AnalysisProvenance';
import User from '@modules/auth/models/User';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Container from '@modules/container/models/Container';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import Notification from '@modules/notification/models/Notification';
import Plugin from '@modules/plugin/models/Plugin';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import Session from '@modules/session/models/Session';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import ClusterMetricSample from '@modules/system/models/ClusterMetricSample';
import DeploymentSettings from '@modules/system/models/DeploymentSettings';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';

const ENTITIES: readonly Function[] = [
    User,
    Team,
    TeamRole,
    TeamMember,
    TeamInvitation,
    SecretKey,
    SecretKeyUsageLog,
    TeamAIIntegration,
    CatalogFolder,
    Session,
    Notification,
    DailyActivity,
    DeploymentSettings,
    AIConversation,
    AIMessage,
    TeamCluster,
    ClusterTransferJob,
    StoragePlacement,
    Trajectory,
    TrajectoryFrame,
    TrajectoryCloneJob,
    TrajectoryUploadSession,
    SceneArtifact,
    SimulationCell,
    Plugin,
    Analysis,
    AnalysisProvenance,
    Container,
    Whiteboard,
    ScriptingNotebook,
    KeyValueEntry,
    KeyValueSetMember,
    DomainEventSpoolEntry,
    ClusterMetricSample
];

export const getEntities = (): DatabaseEntities => [...ENTITIES];
