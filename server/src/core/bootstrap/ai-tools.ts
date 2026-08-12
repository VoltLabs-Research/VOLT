import type AIToolController from '@shared/ai/AIToolController';
import AiAIToolController from '@modules/ai/ai-tools/AiAIToolController';
import AnalysisAIToolController from '@modules/analysis/ai-tools/AnalysisAIToolController';
import AuthAIToolController from '@modules/auth/ai-tools/AuthAIToolController';
import ClusterAIToolController from '@modules/cluster/ai-tools/ClusterAIToolController';
import ContainerAIToolController from '@modules/container/ai-tools/ContainerAIToolController';
import DailyActivityAIToolController from '@modules/daily-activity/ai-tools/DailyActivityAIToolController';
import DashboardAIToolController from '@modules/dashboard/ai-tools/DashboardAIToolController';
import JobsAIToolController from '@modules/jobs/ai-tools/JobsAIToolController';
import NotificationAIToolController from '@modules/notification/ai-tools/NotificationAIToolController';
import PluginAIToolController from '@modules/plugin/ai-tools/PluginAIToolController';
import RasterAIToolController from '@modules/raster/ai-tools/RasterAIToolController';
import ScriptingAIToolController from '@modules/scripting/ai-tools/ScriptingAIToolController';
import SessionAIToolController from '@modules/session/ai-tools/SessionAIToolController';
import SimulationCellAIToolController from '@modules/simulation-cell/ai-tools/SimulationCellAIToolController';
import TeamAIToolController from '@modules/team/ai-tools/TeamAIToolController';
import TrajectoryAIToolController from '@modules/trajectory/ai-tools/TrajectoryAIToolController';
import WhiteboardAIToolController from '@modules/whiteboards/ai-tools/WhiteboardAIToolController';

export const AI_TOOL_CONTROLLERS: readonly (new () => AIToolController)[] = [
    AiAIToolController,
    AnalysisAIToolController,
    AuthAIToolController,
    ClusterAIToolController,
    ContainerAIToolController,
    DailyActivityAIToolController,
    DashboardAIToolController,
    JobsAIToolController,
    NotificationAIToolController,
    PluginAIToolController,
    RasterAIToolController,
    ScriptingAIToolController,
    SessionAIToolController,
    SimulationCellAIToolController,
    TeamAIToolController,
    TrajectoryAIToolController,
    WhiteboardAIToolController,
];
