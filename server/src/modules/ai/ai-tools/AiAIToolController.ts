import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool, ClientAITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AiService from '@modules/ai/services/AiService';
import type {
    ConfigureColorCodingInput,
    ControlPlaybackInput,
    DeleteConversationInput,
    FocusResultInput,
    LaunchGrainSegmentationAnalysisInput,
    ListConversationsInput,
    NavigateToInput,
    NoParamsInput,
    OpenCommandPaletteInput,
    OpenInViewerInput,
    OpenPanelInput,
    PushExpressionSelectInput,
    ResetViewSettingsInput,
    SeekFrameInput,
    SetAppearanceInput,
    SetCameraViewInput,
    SetChatSurfaceInput,
    SetEnvironmentInput,
    SetPlaybackInput,
    SetThemeInput,
    SetVisibleLayersInput,
    SwitchTeamInput,
    UpdateConversationInput
} from '@volt/contracts/modules/ai/ai-tools';

export default class AiAIToolController extends AIToolController {
    #service = new AiService();

    @AITool({
        name: 'list_conversations',
        description: 'List all AI conversations for the current user.',
        parameters: typia.llm.parameters<ListConversationsInput>(),
        validate: typia.createValidate<ListConversationsInput>()
    })
    async listConversations(input: ListConversationsInput & AIToolScope) {
        const { total, data } = await this.#service.listConversations(input);
        return {
            summary: `Found ${total} conversations.`,
            data,
            total
        };
    }

    @AITool({
        name: 'update_conversation',
        description: 'Update an AI conversation title.',
        parameters: typia.llm.parameters<UpdateConversationInput>(),
        validate: typia.createValidate<UpdateConversationInput>()
    })
    async updateConversation(input: UpdateConversationInput & AIToolScope) {
        return this.#service.updateConversation(input);
    }

    @AITool({
        name: 'delete_conversation',
        description: 'Delete an AI conversation.',
        parameters: typia.llm.parameters<DeleteConversationInput>(),
        validate: typia.createValidate<DeleteConversationInput>()
    })
    async deleteConversation(input: DeleteConversationInput & AIToolScope) {
        await this.#service.deleteConversation(input);
        return { deleted: true };
    }

    @ClientAITool({
        name: 'navigate_to',
        description: 'Navigate the user to an in-app page by logical destination key with resolved entity ids. '
            + 'Use this to take the user somewhere after answering (e.g. to a trajectory, an analysis, a cluster). '
            + 'Only known destinations are allowed; resolve ids with global_search / list_* first.',
        parameters: typia.llm.parameters<NavigateToInput>(),
        validate: typia.createValidate<NavigateToInput>()
    })
    navigateTo(): void {}

    @ClientAITool({
        name: 'open_in_viewer',
        description: 'Open a trajectory in the 3D viewer so the user can see the simulation. '
            + 'Optionally focus a specific analysis (analysisId) or open inside a collaborator\'s workspace (ownerId). '
            + 'Resolve ids with global_search / list_* first.',
        parameters: typia.llm.parameters<OpenInViewerInput>(),
        validate: typia.createValidate<OpenInViewerInput>()
    })
    openInViewer(): void {}

    @ClientAITool({
        name: 'switch_team',
        description: 'Switch the active team context and take the user to the dashboard. '
            + 'This changes which team\'s trajectories, clusters, and data are visible. Resolve the team id with global_search / list_* first.',
        parameters: typia.llm.parameters<SwitchTeamInput>(),
        validate: typia.createValidate<SwitchTeamInput>(),
        needsApproval: true
    })
    switchTeam(): void {}

    @ClientAITool({
        name: 'open_command_palette',
        description: 'Open, close, or toggle the command palette so the user can quickly search and run commands.',
        parameters: typia.llm.parameters<OpenCommandPaletteInput>(),
        validate: typia.createValidate<OpenCommandPaletteInput>()
    })
    openCommandPalette(): void {}

    @ClientAITool({
        name: 'open_panel',
        description: 'Open a sidebar panel and/or select a modifier inside the 3D viewer editor. '
            + 'Use this to direct the user to the right controls (e.g. appearance, camera, lights) before or after explaining a change.',
        parameters: typia.llm.parameters<OpenPanelInput>(),
        validate: typia.createValidate<OpenPanelInput>()
    })
    openPanel(): void {}

    @ClientAITool({
        name: 'set_chat_surface',
        description: 'Move the assistant UI: open the floating chat widget, go to the full AI page, or hide the widget. '
            + 'Use when the user asks to "open the assistant here", "go to the chat page", or "minimize the chat".',
        parameters: typia.llm.parameters<SetChatSurfaceInput>(),
        validate: typia.createValidate<SetChatSurfaceInput>()
    })
    setChatSurface(): void {}

    @ClientAITool({
        name: 'focus_result',
        description: 'Focus and highlight a specific analysis result / modifier in the viewer UI by its id, '
            + 'or pass null to clear the current focus. Use this to point the user at a result you are discussing.',
        parameters: typia.llm.parameters<FocusResultInput>(),
        validate: typia.createValidate<FocusResultInput>()
    })
    focusResult(): void {}

    @ClientAITool({
        name: 'get_viewer_state',
        description: 'Read-only snapshot of the live 3D viewer: trajectory id, current frame/timestep, '
            + 'whether playback is running and at what speed, the active scene, point-size multiplier, background '
            + 'color, whether the simulation cell is shown, and the active sidebar option. Call this first to '
            + 'understand what the user is currently viewing before adjusting the view.',
        parameters: typia.llm.parameters<NoParamsInput>(),
        validate: typia.createValidate<NoParamsInput>()
    })
    getViewerState(): void {}

    @ClientAITool({
        name: 'set_camera_view',
        description: 'Snap the 3D viewer camera to a named viewpoint: front, back, left, right, top, bottom, or isometric. '
            + 'Use this when the user asks to "look from the top", "view from the side", "show the front", or "give me an isometric view". '
            + 'Only works while a trajectory viewer is open.',
        parameters: typia.llm.parameters<SetCameraViewInput>(),
        validate: typia.createValidate<SetCameraViewInput>()
    })
    setCameraView(): void {}

    @ClientAITool({
        name: 'reset_camera',
        description: 'Reset the 3D viewer camera and orbit controls to the default view that frames the whole scene. '
            + 'Use this when the user is lost in the scene, has zoomed/panned too far, or asks to "reset the view" or "recenter". '
            + 'Only works while a trajectory viewer is open.',
        parameters: typia.llm.parameters<NoParamsInput>(),
        validate: typia.createValidate<NoParamsInput>()
    })
    resetCamera(): void {}

    @ClientAITool({
        name: 'set_playback',
        description: 'Configure trajectory playback settings in the open 3D viewer: playback speed '
            + '(0.1-10x), target fps, and the loop range (start/end timesteps). Use when the user wants playback '
            + 'faster/slower or limited to a frame range. Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<SetPlaybackInput>(),
        validate: typia.createValidate<SetPlaybackInput>()
    })
    setPlayback(): void {}

    @ClientAITool({
        name: 'control_playback',
        description: 'Play, pause, or stop the trajectory animation in the open 3D viewer. '
            + 'Use when the user wants to start/resume or halt frame-by-frame playback of a simulation. '
            + 'Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<ControlPlaybackInput>(),
        validate: typia.createValidate<ControlPlaybackInput>()
    })
    controlPlayback(): void {}

    @ClientAITool({
        name: 'seek_frame',
        description: 'Jump the open 3D viewer to a specific trajectory frame by exact timestep, '
            + 'or relatively (first, last, next, previous). Use when the user wants to scrub to a particular '
            + 'point in the simulation. Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<SeekFrameInput>(),
        validate: typia.createValidate<SeekFrameInput>()
    })
    seekFrame(): void {}

    @ClientAITool({
        name: 'set_appearance',
        description: 'Adjust how the 3D viewer looks: point/atom size, whether the simulation cell box is '
            + 'shown, and the render-quality preset (ultra/high/balanced/performance/battery). Provide only the '
            + 'fields you want to change.',
        parameters: typia.llm.parameters<SetAppearanceInput>(),
        validate: typia.createValidate<SetAppearanceInput>()
    })
    setAppearance(): void {}

    @ClientAITool({
        name: 'set_environment',
        description: 'Adjust the 3D scene environment: background color, the reference floor grid on/off, '
            + 'and distance fog (enable, color, near/far). Provide only the fields you want to change.',
        parameters: typia.llm.parameters<SetEnvironmentInput>(),
        validate: typia.createValidate<SetEnvironmentInput>()
    })
    setEnvironment(): void {}

    @ClientAITool({
        name: 'set_visible_layers',
        description: 'Show or hide a scene layer in the 3D viewer. Currently supports the base atomistic '
            + 'point-cloud layer ("atoms"). Analysis overlays (plugin results, color-coding, filters, line styles) '
            + 'are configured from their own panels and are not toggled here.',
        parameters: typia.llm.parameters<SetVisibleLayersInput>(),
        validate: typia.createValidate<SetVisibleLayersInput>()
    })
    setVisibleLayers(): void {}

    @ClientAITool({
        name: 'set_theme',
        description: 'Switch the application appearance between light, dark, or system (OS-following) theme.',
        parameters: typia.llm.parameters<SetThemeInput>(),
        validate: typia.createValidate<SetThemeInput>()
    })
    setTheme(): void {}

    @ClientAITool({
        name: 'reset_view_settings',
        description: 'Undo or redo the last viewer change, or reset every viewer setting (camera, lights, '
            + 'effects, grid, environment, appearance) back to defaults. Use "reset_all" only when the user wants '
            + 'a clean slate.',
        parameters: typia.llm.parameters<ResetViewSettingsInput>(),
        validate: typia.createValidate<ResetViewSettingsInput>()
    })
    resetViewSettings(): void {}

    @ClientAITool({
        name: 'configure_color_coding',
        description: 'Apply a color-coding modifier to the 3D viewer: color atoms by a per-atom property '
            + '(e.g. StructureType, Epot, cluster_id) using a named color map. Changes broadcast to collaborators.',
        parameters: typia.llm.parameters<ConfigureColorCodingInput>(),
        validate: typia.createValidate<ConfigureColorCodingInput>()
    })
    configureColorCoding(): void {}

    @ClientAITool({
        name: 'push_expression_select',
        description: 'Highlight atoms matching a boolean formula over per-atom properties. '
            + 'Example: "Position.X > 10 && StructureType == 2". The match count is returned.',
        parameters: typia.llm.parameters<PushExpressionSelectInput>(),
        validate: typia.createValidate<PushExpressionSelectInput>()
    })
    pushExpressionSelect(): void {}

    @ClientAITool({
        name: 'launch_grain_segmentation_analysis',
        description: 'Queue a grain-segmentation analysis with the given dislocation-density threshold. '
            + 'Returns a jobId for tracking. The result renders as a dislocation network GLB in the viewer.',
        parameters: typia.llm.parameters<LaunchGrainSegmentationAnalysisInput>(),
        validate: typia.createValidate<LaunchGrainSegmentationAnalysisInput>()
    })
    launchGrainSegmentation(): void {}
}
