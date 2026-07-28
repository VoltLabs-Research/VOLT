import type { ToolSet } from 'ai';
import type AIToolController from '@shared/ai/AIToolController';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

import AiAIToolController from '@modules/ai/ai-tools/AiAIToolController';
import AnalysisAIToolController from '@modules/analysis/ai-tools/AnalysisAIToolController';
import AuthAIToolController from '@modules/auth/ai-tools/AuthAIToolController';
import ChatAIToolController from '@modules/chat/ai-tools/ChatAIToolController';
import ClusterAIToolController from '@modules/cluster/ai-tools/ClusterAIToolController';
import ContainerAIToolController from '@modules/container/ai-tools/ContainerAIToolController';
import DailyActivityAIToolController from '@modules/daily-activity/ai-tools/DailyActivityAIToolController';
import DashboardAIToolController from '@modules/dashboard/ai-tools/DashboardAIToolController';
import JobsAIToolController from '@modules/jobs/ai-tools/JobsAIToolController';
import LatexAIToolController from '@modules/latex/ai-tools/LatexAIToolController';
import NotificationAIToolController from '@modules/notification/ai-tools/NotificationAIToolController';
import PluginAIToolController from '@modules/plugin/ai-tools/PluginAIToolController';
import RasterAIToolController from '@modules/raster/ai-tools/RasterAIToolController';
import ScriptingAIToolController from '@modules/scripting/ai-tools/ScriptingAIToolController';
import SessionAIToolController from '@modules/session/ai-tools/SessionAIToolController';
import SimulationCellAIToolController from '@modules/simulation-cell/ai-tools/SimulationCellAIToolController';
import TeamAIToolController from '@modules/team/ai-tools/TeamAIToolController';
import TrajectoryAIToolController from '@modules/trajectory/ai-tools/TrajectoryAIToolController';
import WhiteboardAIToolController from '@modules/whiteboards/ai-tools/WhiteboardAIToolController';

const controllers: AIToolController[] = [
    new AiAIToolController(),
    new AnalysisAIToolController(),
    new AuthAIToolController(),
    new ChatAIToolController(),
    new ClusterAIToolController(),
    new ContainerAIToolController(),
    new DailyActivityAIToolController(),
    new DashboardAIToolController(),
    new JobsAIToolController(),
    new LatexAIToolController(),
    new NotificationAIToolController(),
    new PluginAIToolController(),
    new RasterAIToolController(),
    new ScriptingAIToolController(),
    new SessionAIToolController(),
    new SimulationCellAIToolController(),
    new TeamAIToolController(),
    new TrajectoryAIToolController(),
    new WhiteboardAIToolController()
];

class AIToolService {
    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = { teamId, userId };
        const tools: ToolSet = {};

        for (const controller of controllers) {
            Object.assign(tools, controller.buildTools(scope));
        }

        return tools;
    }
}

export default new AIToolService();
