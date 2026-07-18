import type { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import type { ToolSet } from 'ai';

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

import { ChatCollaborationAITool } from '@modules/chat/ai-tools/ChatCollaborationAITool';
import { ClonePluginAITool } from '@modules/plugin/ai-tools/ClonePluginAITool';
import { CloneTrajectoryAITool } from '@modules/trajectory/ai-tools/CloneTrajectoryAITool';
import { ComparePluginsAITool } from '@modules/plugin/ai-tools/ComparePluginsAITool';
import { CompileLatexDocumentAITool } from '@modules/latex/ai-tools/CompileLatexDocumentAITool';
import { CreateContainerAITool } from '@modules/container/ai-tools/CreateContainerAITool';
import { CreateLatexDocumentAITool } from '@modules/latex/ai-tools/CreateLatexDocumentAITool';
import { CreateLatexFileAITool } from '@modules/latex/ai-tools/CreateLatexFileAITool';
import { CreateWhiteboardAITool } from '@modules/whiteboards/ai-tools/CreateWhiteboardAITool';
import { DeleteContainerAITool } from '@modules/container/ai-tools/DeleteContainerAITool';
import { DeleteLatexDocumentAITool } from '@modules/latex/ai-tools/DeleteLatexDocumentAITool';
import { DeleteLatexFileAITool } from '@modules/latex/ai-tools/DeleteLatexFileAITool';
import { DeleteTrajectoryAITool } from '@modules/trajectory/ai-tools/DeleteTrajectoryAITool';
import { DeleteTrajectoryFolderAITool } from '@modules/trajectory/ai-tools/DeleteTrajectoryFolderAITool';
import { DeleteWhiteboardAITool } from '@modules/whiteboards/ai-tools/DeleteWhiteboardAITool';
import { DeleteWhiteboardFolderAITool } from '@modules/whiteboards/ai-tools/DeleteWhiteboardFolderAITool';
import { DescribePluginArgumentsAITool } from '@modules/plugin/ai-tools/DescribePluginArgumentsAITool';
import { DrawOnWhiteboardAITool } from '@modules/whiteboards/ai-tools/DrawOnWhiteboardAITool';
import { ExecutePipelineAITool } from '@modules/plugin/ai-tools/ExecutePipelineAITool';
import { ExportAnalysisResultAITool } from '@modules/plugin/ai-tools/ExportAnalysisResultAITool';
import { GenerateClusterInstallManifestAITool } from '@modules/cluster/ai-tools/GenerateClusterInstallManifestAITool';
import { GetActivitySummaryAITool } from '@modules/daily-activity/ai-tools/GetActivitySummaryAITool';
import { GetClusterAITool } from '@modules/cluster/ai-tools/GetClusterAITool';
import { GetClusterHealthSummaryAITool } from '@modules/cluster/ai-tools/GetClusterHealthSummaryAITool';
import { GetClusterResourceLimitsAITool } from '@modules/cluster/ai-tools/GetClusterResourceLimitsAITool';
import { GetClusterRuntimeSnapshotAITool } from '@modules/cluster/ai-tools/GetClusterRuntimeSnapshotAITool';
import { GetContainerByIdAITool } from '@modules/container/ai-tools/GetContainerByIdAITool';
import { GetContainerPortAccessUrlAITool } from '@modules/container/ai-tools/GetContainerPortAccessUrlAITool';
import { GetContainerProcessesAITool } from '@modules/container/ai-tools/GetContainerProcessesAITool';
import { GetContainerStatsAITool } from '@modules/container/ai-tools/GetContainerStatsAITool';
import { GetDashboardMetricsAITool } from '@modules/dashboard/ai-tools/GetDashboardMetricsAITool';
import { GetLatexDocumentAITool } from '@modules/latex/ai-tools/GetLatexDocumentAITool';
import { GetLatexFileContentAITool } from '@modules/latex/ai-tools/GetLatexFileContentAITool';
import { GetNotificationsAITool } from '@modules/notification/ai-tools/GetNotificationsAITool';
import { GetPluginByIdAITool } from '@modules/plugin/ai-tools/GetPluginByIdAITool';
import { GetSimulationCellAITool } from '@modules/simulation-cell/ai-tools/GetSimulationCellAITool';
import { GetSubListingAITool } from '@modules/plugin/ai-tools/GetSubListingAITool';
import { GetTeamContextAITool } from '@modules/team/ai-tools/GetTeamContextAITool';
import { GetTeamMetricsAITool } from '@modules/trajectory/ai-tools/GetTeamMetricsAITool';
import { GetTrajectoryAITool } from '@modules/trajectory/ai-tools/GetTrajectoryAITool';
import { GetWhiteboardAITool } from '@modules/whiteboards/ai-tools/GetWhiteboardAITool';
import { GetWhiteboardStateAITool } from '@modules/whiteboards/ai-tools/GetWhiteboardStateAITool';
import { GlobalSearchAITool } from '@modules/dashboard/ai-tools/GlobalSearchAITool';
import { InstallPluginAITool } from '@modules/plugin/ai-tools/InstallPluginAITool';
import { ListAnalysisResultOptionsAITool } from '@modules/plugin/ai-tools/ListAnalysisResultOptionsAITool';
import { ListClustersAITool } from '@modules/cluster/ai-tools/ListClustersAITool';
import { ListClusterTransferJobsAITool } from '@modules/cluster/ai-tools/ListClusterTransferJobsAITool';
import { ListContainerFilesAITool } from '@modules/container/ai-tools/ListContainerFilesAITool';
import { ListContainersAITool } from '@modules/container/ai-tools/ListContainersAITool';
import { ListLatexDocumentsAITool } from '@modules/latex/ai-tools/ListLatexDocumentsAITool';
import { ListLatexFilesAITool } from '@modules/latex/ai-tools/ListLatexFilesAITool';
import { ListPluginListingDocumentsAITool } from '@modules/plugin/ai-tools/ListPluginListingDocumentsAITool';
import { ListPluginsAITool } from '@modules/plugin/ai-tools/ListPluginsAITool';
import { ListPublicTrajectoriesAITool } from '@modules/trajectory/ai-tools/ListPublicTrajectoriesAITool';
import { ListRemoteClusterFilesAITool } from '@modules/cluster/ai-tools/ListRemoteClusterFilesAITool';
import { ListSampleSimulationsAITool } from '@modules/trajectory/ai-tools/ListSampleSimulationsAITool';
import { ListTrajectoriesAITool } from '@modules/trajectory/ai-tools/ListTrajectoriesAITool';
import { ListWhiteboardsAITool } from '@modules/whiteboards/ai-tools/ListWhiteboardsAITool';
import { ManageDemoClusterAITool } from '@modules/cluster/ai-tools/ManageDemoClusterAITool';
import { ManageLatexAssetsAITool } from '@modules/latex/ai-tools/ManageLatexAssetsAITool';
import { ManageSessionsAITool } from '@modules/session/ai-tools/ManageSessionsAITool';
import { MoveContainerAITool } from '@modules/container/ai-tools/MoveContainerAITool';
import { MoveLatexDocumentAITool } from '@modules/latex/ai-tools/MoveLatexDocumentAITool';
import { MoveTrajectoryAITool } from '@modules/trajectory/ai-tools/MoveTrajectoryAITool';
import { MoveWhiteboardAITool } from '@modules/whiteboards/ai-tools/MoveWhiteboardAITool';
import { PublishPluginAITool } from '@modules/plugin/ai-tools/PublishPluginAITool';
import { ReadAnalysisResultRowsAITool } from '@modules/plugin/ai-tools/ReadAnalysisResultRowsAITool';
import { ReadContainerFileAITool } from '@modules/container/ai-tools/ReadContainerFileAITool';
import { RegenerateClusterTokenAITool } from '@modules/cluster/ai-tools/RegenerateClusterTokenAITool';
import { RemoveTeamRunningJobsAITool } from '@modules/jobs/ai-tools/RemoveTeamRunningJobsAITool';
import { RenderSceneScreenshotAITool } from '@modules/raster/ai-tools/RenderSceneScreenshotAITool';
import { RetryTeamFailedJobsAITool } from '@modules/jobs/ai-tools/RetryTeamFailedJobsAITool';
import { RevealClusterCredentialsAITool } from '@modules/cluster/ai-tools/RevealClusterCredentialsAITool';
import { SearchRegistryPluginsAITool } from '@modules/plugin/ai-tools/SearchRegistryPluginsAITool';
import { SetLatexFileEntrypointAITool } from '@modules/latex/ai-tools/SetLatexFileEntrypointAITool';
import { SummarizeAnalysisResultAITool } from '@modules/plugin/ai-tools/SummarizeAnalysisResultAITool';
import { UninstallPluginAITool } from '@modules/plugin/ai-tools/UninstallPluginAITool';
import { UpdateClusterQueueConcurrencyAITool } from '@modules/cluster/ai-tools/UpdateClusterQueueConcurrencyAITool';
import { UpdateClusterRoleAITool } from '@modules/cluster/ai-tools/UpdateClusterRoleAITool';
import { UpdateContainerAITool } from '@modules/container/ai-tools/UpdateContainerAITool';
import { UpdateLatexDocumentAITool } from '@modules/latex/ai-tools/UpdateLatexDocumentAITool';
import { UpdateLatexFileAITool } from '@modules/latex/ai-tools/UpdateLatexFileAITool';
import { UpdateProfileAITool } from '@modules/auth/ai-tools/UpdateProfileAITool';
import { UpdateTrajectoryAITool } from '@modules/trajectory/ai-tools/UpdateTrajectoryAITool';
import { UpdateWhiteboardAITool } from '@modules/whiteboards/ai-tools/UpdateWhiteboardAITool';
import { ValidateWorkflowAITool } from '@modules/plugin/ai-tools/ValidateWorkflowAITool';

const allAiTools: AITool<any>[] = [
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
    new UpdateScriptingNotebookAITool(),
    new ChatCollaborationAITool(),
    new ClonePluginAITool(),
    new CloneTrajectoryAITool(),
    new ComparePluginsAITool(),
    new CompileLatexDocumentAITool(),
    new CreateContainerAITool(),
    new CreateLatexDocumentAITool(),
    new CreateLatexFileAITool(),
    new CreateWhiteboardAITool(),
    new DeleteContainerAITool(),
    new DeleteLatexDocumentAITool(),
    new DeleteLatexFileAITool(),
    new DeleteTrajectoryAITool(),
    new DeleteTrajectoryFolderAITool(),
    new DeleteWhiteboardAITool(),
    new DeleteWhiteboardFolderAITool(),
    new DescribePluginArgumentsAITool(),
    new DrawOnWhiteboardAITool(),
    new ExecutePipelineAITool(),
    new ExportAnalysisResultAITool(),
    new GenerateClusterInstallManifestAITool(),
    new GetActivitySummaryAITool(),
    new GetClusterAITool(),
    new GetClusterHealthSummaryAITool(),
    new GetClusterResourceLimitsAITool(),
    new GetClusterRuntimeSnapshotAITool(),
    new GetContainerByIdAITool(),
    new GetContainerPortAccessUrlAITool(),
    new GetContainerProcessesAITool(),
    new GetContainerStatsAITool(),
    new GetDashboardMetricsAITool(),
    new GetLatexDocumentAITool(),
    new GetLatexFileContentAITool(),
    new GetNotificationsAITool(),
    new GetPluginByIdAITool(),
    new GetSimulationCellAITool(),
    new GetSubListingAITool(),
    new GetTeamContextAITool(),
    new GetTeamMetricsAITool(),
    new GetTrajectoryAITool(),
    new GetWhiteboardAITool(),
    new GetWhiteboardStateAITool(),
    new GlobalSearchAITool(),
    new InstallPluginAITool(),
    new ListAnalysisResultOptionsAITool(),
    new ListClustersAITool(),
    new ListClusterTransferJobsAITool(),
    new ListContainerFilesAITool(),
    new ListContainersAITool(),
    new ListLatexDocumentsAITool(),
    new ListLatexFilesAITool(),
    new ListPluginListingDocumentsAITool(),
    new ListPluginsAITool(),
    new ListPublicTrajectoriesAITool(),
    new ListRemoteClusterFilesAITool(),
    new ListSampleSimulationsAITool(),
    new ListTrajectoriesAITool(),
    new ListWhiteboardsAITool(),
    new ManageDemoClusterAITool(),
    new ManageLatexAssetsAITool(),
    new ManageSessionsAITool(),
    new MoveContainerAITool(),
    new MoveLatexDocumentAITool(),
    new MoveTrajectoryAITool(),
    new MoveWhiteboardAITool(),
    new PublishPluginAITool(),
    new ReadAnalysisResultRowsAITool(),
    new ReadContainerFileAITool(),
    new RegenerateClusterTokenAITool(),
    new RemoveTeamRunningJobsAITool(),
    new RenderSceneScreenshotAITool(),
    new RetryTeamFailedJobsAITool(),
    new RevealClusterCredentialsAITool(),
    new SearchRegistryPluginsAITool(),
    new SetLatexFileEntrypointAITool(),
    new SummarizeAnalysisResultAITool(),
    new UninstallPluginAITool(),
    new UpdateClusterQueueConcurrencyAITool(),
    new UpdateClusterRoleAITool(),
    new UpdateContainerAITool(),
    new UpdateLatexDocumentAITool(),
    new UpdateLatexFileAITool(),
    new UpdateProfileAITool(),
    new UpdateTrajectoryAITool(),
    new UpdateWhiteboardAITool(),
    new ValidateWorkflowAITool()
];

class AIToolService {
    createToolsForContext(teamId: string, userId: string): ToolSet {
        const scope: AIToolScope = { teamId, userId };
        const allTools: ToolSet = {};
        for (const tool of allAiTools) {
            Object.assign(allTools, tool.build(scope));
        }
        return allTools;
    }
}

export default new AIToolService();
