import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import type { ToolSet } from 'ai';
import { container as diContainer } from 'tsyringe';

import { ControlPlaybackAITool } from '@modules/ai/ai-tools/ControlPlaybackAITool';
import { DeleteConversationAITool } from '@modules/ai/ai-tools/DeleteConversationAITool';
import { FocusResultAITool } from '@modules/ai/ai-tools/FocusResultAITool';
import { GetViewerStateAITool } from '@modules/ai/ai-tools/GetViewerStateAITool';
import { ListConversationsAITool } from '@modules/ai/ai-tools/ListConversationsAITool';
import { NavigateToAITool } from '@modules/ai/ai-tools/NavigateToAITool';
import { OpenCommandPaletteAITool } from '@modules/ai/ai-tools/OpenCommandPaletteAITool';
import { OpenInViewerAITool } from '@modules/ai/ai-tools/OpenInViewerAITool';
import { OpenPanelAITool } from '@modules/ai/ai-tools/OpenPanelAITool';
import {
    ConfigureColorCodingAITool,
    PushExpressionSelectAITool,
    LaunchGrainSegmentationAITool
} from '@modules/ai/ai-tools/PipelineComposerAITools';
import { ResetCameraAITool } from '@modules/ai/ai-tools/ResetCameraAITool';
import { ResetViewSettingsAITool } from '@modules/ai/ai-tools/ResetViewSettingsAITool';
import { SeekFrameAITool } from '@modules/ai/ai-tools/SeekFrameAITool';
import { SetAppearanceAITool } from '@modules/ai/ai-tools/SetAppearanceAITool';
import { SetCameraViewAITool } from '@modules/ai/ai-tools/SetCameraViewAITool';
import { SetChatSurfaceAITool } from '@modules/ai/ai-tools/SetChatSurfaceAITool';
import { SetEnvironmentAITool } from '@modules/ai/ai-tools/SetEnvironmentAITool';
import { SetPlaybackAITool } from '@modules/ai/ai-tools/SetPlaybackAITool';
import { SetThemeAITool } from '@modules/ai/ai-tools/SetThemeAITool';
import { SetVisibleLayersAITool } from '@modules/ai/ai-tools/SetVisibleLayersAITool';
import { SwitchTeamAITool } from '@modules/ai/ai-tools/SwitchTeamAITool';
import { UpdateConversationAITool } from '@modules/ai/ai-tools/UpdateConversationAITool';

import { CompareAnalysesAITool } from '@modules/analysis/ai-tools/CompareAnalysesAITool';
import { DeleteAnalysisAITool } from '@modules/analysis/ai-tools/DeleteAnalysisAITool';
import { GetAnalysisAITool } from '@modules/analysis/ai-tools/GetAnalysisAITool';
import { GetAnalysisArtifactsAITool } from '@modules/analysis/ai-tools/GetAnalysisArtifactsAITool';
import { GetAnalysisFrameLogAITool } from '@modules/analysis/ai-tools/GetAnalysisFrameLogAITool';
import { ListAnalysesAITool } from '@modules/analysis/ai-tools/ListAnalysesAITool';
import { ListAnalysesByConfigAITool } from '@modules/analysis/ai-tools/ListAnalysesByConfigAITool';
import { ListTrajectoryAnalysesAITool } from '@modules/analysis/ai-tools/ListTrajectoryAnalysesAITool';
import { RetryFailedAnalysisFramesAITool } from '@modules/analysis/ai-tools/RetryFailedAnalysisFramesAITool';
import { SummarizeAnalysisRunAITool } from '@modules/analysis/ai-tools/SummarizeAnalysisRunAITool';

import { CreateScriptingNotebookAITool } from '@modules/scripting/ai-tools/CreateScriptingNotebookAITool';
import { DeleteScriptingNotebookAITool } from '@modules/scripting/ai-tools/DeleteScriptingNotebookAITool';
import { GetScriptingSessionStatusAITool } from '@modules/scripting/ai-tools/GetScriptingSessionStatusAITool';
import { ListScriptingNotebooksAITool } from '@modules/scripting/ai-tools/ListScriptingNotebooksAITool';
import { StartScriptingJupyterSessionAITool } from '@modules/scripting/ai-tools/StartScriptingJupyterSessionAITool';
import { StopScriptingSessionAITool } from '@modules/scripting/ai-tools/StopScriptingSessionAITool';
import { UpdateScriptingNotebookAITool } from '@modules/scripting/ai-tools/UpdateScriptingNotebookAITool';

const ownedAITools: AITool<any>[] = [
    new ControlPlaybackAITool(),
    new DeleteConversationAITool(),
    new FocusResultAITool(),
    new GetViewerStateAITool(),
    new ListConversationsAITool(),
    new NavigateToAITool(),
    new OpenCommandPaletteAITool(),
    new OpenInViewerAITool(),
    new OpenPanelAITool(),
    new ConfigureColorCodingAITool(),
    new PushExpressionSelectAITool(),
    new LaunchGrainSegmentationAITool(),
    new ResetCameraAITool(),
    new ResetViewSettingsAITool(),
    new SeekFrameAITool(),
    new SetAppearanceAITool(),
    new SetCameraViewAITool(),
    new SetChatSurfaceAITool(),
    new SetEnvironmentAITool(),
    new SetPlaybackAITool(),
    new SetThemeAITool(),
    new SetVisibleLayersAITool(),
    new SwitchTeamAITool(),
    new UpdateConversationAITool(),
    new CompareAnalysesAITool(),
    new DeleteAnalysisAITool(),
    new GetAnalysisAITool(),
    new GetAnalysisArtifactsAITool(),
    new GetAnalysisFrameLogAITool(),
    new ListAnalysesAITool(),
    new ListAnalysesByConfigAITool(),
    new ListTrajectoryAnalysesAITool(),
    new RetryFailedAnalysisFramesAITool(),
    new SummarizeAnalysisRunAITool(),
    new CreateScriptingNotebookAITool(),
    new DeleteScriptingNotebookAITool(),
    new GetScriptingSessionStatusAITool(),
    new ListScriptingNotebooksAITool(),
    new StartScriptingJupyterSessionAITool(),
    new StopScriptingSessionAITool(),
    new UpdateScriptingNotebookAITool()
];

class AIToolService {
    #externalAITools?: AITool[];

    get #externalTools(): AITool[] {
        return this.#externalAITools ??= diContainer.resolveAll<AITool>(AI_TOOL_TOKENS.AITool);
    }

    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = { teamId, userId };
        const allTools: ToolSet = {};
        for (const tool of [...ownedAITools, ...this.#externalTools]) {
            Object.assign(allTools, tool.build(scope));
        }
        return allTools;
    }
}

export default new AIToolService();
