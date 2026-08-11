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

/**
 * Every module's AI tool surface, named.
 *
 * This is the same shape as `entities.ts` next door, and for the same reason: the
 * set is finite, it changes when a module is added, and naming it is what lets
 * `tsc`, the bundler and an IDE's "find references" see the wiring.
 *
 * It replaces a `@AIToolProvider()` decorator plus a module-level `Set` that was
 * populated as a side effect of importing every file in the project.
 *
 * That design existed to dodge an import cycle, and the cycle is real: the list
 * pulls in `AiAIToolController`, which reaches `AiService`, which comes back to
 * `AIToolService`. Moving the list here is not enough on its own — what breaks
 * the cycle is that nothing under `modules/` imports this file. The entrypoint
 * pushes the list into `AIToolService` instead, so the arrow only ever points
 * from the composition root into a module, never back.
 */
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
