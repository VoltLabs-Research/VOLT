import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool, AIToolAccess, BrowserAITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import conversationService from '@modules/ai/services/ConversationService';
import modelResolver from '@modules/ai/services/ModelResolver';
import chatCompactionService from '@modules/ai/services/chat/ChatCompactionService';
import chatStreamService from '@modules/ai/services/chat/ChatStreamService';
import type {
    CompactContextInput,
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
    @AITool({
        name: 'list_conversations',
        description: 'List all AI conversations for the current user.',
        parameters: typia.llm.parameters<ListConversationsInput>(),
        validate: typia.createValidate<ListConversationsInput>(),
        access: AIToolAccess.Read,
        permission: 'ai-conversation:read'
    })
    async listConversations(input: ListConversationsInput & AIToolScope) {
        const { total, data } = await conversationService.list(input);
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
        validate: typia.createValidate<UpdateConversationInput>(),
        access: AIToolAccess.Write,
        permission: 'ai-conversation:update',
        approval: false
    })
    async updateConversation(input: UpdateConversationInput & AIToolScope) {
        return conversationService.update(input, { title: input.title });
    }

    @AITool({
        name: 'delete_conversation',
        description: 'Delete an AI conversation.',
        parameters: typia.llm.parameters<DeleteConversationInput>(),
        validate: typia.createValidate<DeleteConversationInput>(),
        access: AIToolAccess.Write,
        permission: 'ai-conversation:delete'
    })
    async deleteConversation(input: DeleteConversationInput & AIToolScope) {
        if (input.conversationId === input.currentConversationId) {
            throw new Error('This is the conversation you are talking in: the user deletes it from the conversation list.');
        }

        chatStreamService.stop(input.conversationId);
        await conversationService.delete(input);
        return { deleted: true };
    }

    @AITool({
        name: 'context_compact',
        description: 'Fold the earlier part of this conversation into the summary in front of you, so the next steps have room. '
            + 'Reach for it when the history is getting in the way — long tool results, many rows already read — not as a ritual. '
            + 'Put in remember the ids, numbers and conclusions that must survive the fold; anything left out of it can go. '
            + 'It answers how many messages were folded and how many stay in front of you. The user never sees this.',
        parameters: typia.llm.parameters<CompactContextInput>(),
        validate: typia.createValidate<CompactContextInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    async contextCompact(input: CompactContextInput & AIToolScope) {
        const conversation = await conversationService.owned({
            teamId: input.teamId,
            userId: input.userId,
            conversationId: input.currentConversationId
        });
        const resolved = await modelResolver.resolve(conversation.teamId, conversation.provider ?? undefined, conversation.model ?? undefined);

        return chatCompactionService.compactNow(conversation, resolved.model, input.remember);
    }

    @BrowserAITool({
        name: 'navigate_to',
        description: 'Navigate the user to an in-app page by logical destination key with resolved entity ids. '
            + 'Use this to take the user somewhere after answering (e.g. to a trajectory, an analysis, a cluster). '
            + 'Only known destinations are allowed; resolve ids with global_search / list_* first.',
        parameters: typia.llm.parameters<NavigateToInput>(),
        validate: typia.createValidate<NavigateToInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    navigateTo(): void {}

    @BrowserAITool({
        name: 'open_in_viewer',
        description: 'Open a trajectory in the 3D viewer so the user can see the simulation. '
            + 'Optionally focus a specific analysis (analysisId) or open inside a collaborator\'s workspace (ownerId). '
            + 'Resolve ids with global_search / list_* first.',
        parameters: typia.llm.parameters<OpenInViewerInput>(),
        validate: typia.createValidate<OpenInViewerInput>(),
        access: AIToolAccess.Read,
        permission: 'trajectory:read'
    })
    openInViewer(): void {}

    @BrowserAITool({
        name: 'switch_team',
        description: 'Switch the active team context and take the user to the dashboard. '
            + 'This changes which team\'s trajectories, clusters, and data are visible. Resolve the team id with global_search / list_* first.',
        parameters: typia.llm.parameters<SwitchTeamInput>(),
        validate: typia.createValidate<SwitchTeamInput>(),
        access: AIToolAccess.Write,
        permission: null
    })
    switchTeam(): void {}

    @BrowserAITool({
        name: 'open_command_palette',
        description: 'Open, close, or toggle the command palette so the user can quickly search and run commands.',
        parameters: typia.llm.parameters<OpenCommandPaletteInput>(),
        validate: typia.createValidate<OpenCommandPaletteInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    openCommandPalette(): void {}

    @BrowserAITool({
        name: 'open_panel',
        description: 'Open a sidebar panel and/or select a modifier inside the 3D viewer editor. '
            + 'Use this to direct the user to the right controls (e.g. appearance, camera, lights) before or after explaining a change.',
        parameters: typia.llm.parameters<OpenPanelInput>(),
        validate: typia.createValidate<OpenPanelInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    openPanel(): void {}

    @BrowserAITool({
        name: 'set_chat_surface',
        description: 'Move the assistant UI: open the floating chat widget, go to the full AI page, or hide the widget. '
            + 'Use when the user asks to "open the assistant here", "go to the chat page", or "minimize the chat".',
        parameters: typia.llm.parameters<SetChatSurfaceInput>(),
        validate: typia.createValidate<SetChatSurfaceInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setChatSurface(): void {}

    @BrowserAITool({
        name: 'focus_result',
        description: 'Focus and highlight a specific analysis result / modifier in the viewer UI by its id, '
            + 'or pass null to clear the current focus. Use this to point the user at a result you are discussing.',
        parameters: typia.llm.parameters<FocusResultInput>(),
        validate: typia.createValidate<FocusResultInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    focusResult(): void {}

    @BrowserAITool({
        name: 'get_viewer_state',
        description: 'Read-only snapshot of the live 3D viewer: trajectory id, current frame/timestep, '
            + 'whether playback is running and at what speed, the active scene, point-size multiplier, background '
            + 'color, whether the simulation cell is shown, and the active sidebar option. Call this first to '
            + 'understand what the user is currently viewing before adjusting the view.',
        parameters: typia.llm.parameters<NoParamsInput>(),
        validate: typia.createValidate<NoParamsInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    getViewerState(): void {}

    @BrowserAITool({
        name: 'set_camera_view',
        description: 'Snap the 3D viewer camera to a named viewpoint: front, back, left, right, top, bottom, or isometric. '
            + 'Use this when the user asks to "look from the top", "view from the side", "show the front", or "give me an isometric view". '
            + 'Only works while a trajectory viewer is open.',
        parameters: typia.llm.parameters<SetCameraViewInput>(),
        validate: typia.createValidate<SetCameraViewInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setCameraView(): void {}

    @BrowserAITool({
        name: 'reset_camera',
        description: 'Reset the 3D viewer camera and orbit controls to the default view that frames the whole scene. '
            + 'Use this when the user is lost in the scene, has zoomed/panned too far, or asks to "reset the view" or "recenter". '
            + 'Only works while a trajectory viewer is open.',
        parameters: typia.llm.parameters<NoParamsInput>(),
        validate: typia.createValidate<NoParamsInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    resetCamera(): void {}

    @BrowserAITool({
        name: 'set_playback',
        description: 'Configure trajectory playback settings in the open 3D viewer: playback speed '
            + '(0.1-10x), target fps, and the loop range (start/end timesteps). Use when the user wants playback '
            + 'faster/slower or limited to a frame range. Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<SetPlaybackInput>(),
        validate: typia.createValidate<SetPlaybackInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setPlayback(): void {}

    @BrowserAITool({
        name: 'control_playback',
        description: 'Play, pause, or stop the trajectory animation in the open 3D viewer. '
            + 'Use when the user wants to start/resume or halt frame-by-frame playback of a simulation. '
            + 'Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<ControlPlaybackInput>(),
        validate: typia.createValidate<ControlPlaybackInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    controlPlayback(): void {}

    @BrowserAITool({
        name: 'seek_frame',
        description: 'Jump the open 3D viewer to a specific trajectory frame by exact timestep, '
            + 'or relatively (first, last, next, previous). Use when the user wants to scrub to a particular '
            + 'point in the simulation. Requires an open trajectory in the viewer.',
        parameters: typia.llm.parameters<SeekFrameInput>(),
        validate: typia.createValidate<SeekFrameInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    seekFrame(): void {}

    @BrowserAITool({
        name: 'set_appearance',
        description: 'Adjust how the 3D viewer looks: point/atom size, whether the simulation cell box is '
            + 'shown, and the render-quality preset (ultra/high/balanced/performance/battery). Provide only the '
            + 'fields you want to change.',
        parameters: typia.llm.parameters<SetAppearanceInput>(),
        validate: typia.createValidate<SetAppearanceInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setAppearance(): void {}

    @BrowserAITool({
        name: 'set_environment',
        description: 'Adjust the 3D scene environment: background color, the reference floor grid on/off, '
            + 'and distance fog (enable, color, near/far). Provide only the fields you want to change.',
        parameters: typia.llm.parameters<SetEnvironmentInput>(),
        validate: typia.createValidate<SetEnvironmentInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setEnvironment(): void {}

    @BrowserAITool({
        name: 'set_visible_layers',
        description: 'Show or hide a scene layer in the 3D viewer. Currently supports the base atomistic '
            + 'point-cloud layer ("atoms"). Analysis overlays (plugin results, color-coding, filters, line styles) '
            + 'are configured from their own panels and are not toggled here.',
        parameters: typia.llm.parameters<SetVisibleLayersInput>(),
        validate: typia.createValidate<SetVisibleLayersInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setVisibleLayers(): void {}

    @BrowserAITool({
        name: 'set_theme',
        description: 'Switch the application appearance between light, dark, or system (OS-following) theme.',
        parameters: typia.llm.parameters<SetThemeInput>(),
        validate: typia.createValidate<SetThemeInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    setTheme(): void {}

    @BrowserAITool({
        name: 'reset_view_settings',
        description: 'Undo or redo the last viewer change, or reset every viewer setting (camera, lights, '
            + 'effects, grid, environment, appearance) back to defaults. Use "reset_all" only when the user wants '
            + 'a clean slate.',
        parameters: typia.llm.parameters<ResetViewSettingsInput>(),
        validate: typia.createValidate<ResetViewSettingsInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    resetViewSettings(): void {}

    @BrowserAITool({
        name: 'configure_color_coding',
        description: 'Apply a color-coding modifier to the 3D viewer: color atoms by a per-atom property '
            + '(e.g. StructureType, Epot, cluster_id) using a named color map. Changes broadcast to collaborators.',
        parameters: typia.llm.parameters<ConfigureColorCodingInput>(),
        validate: typia.createValidate<ConfigureColorCodingInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    configureColorCoding(): void {}

    @BrowserAITool({
        name: 'push_expression_select',
        description: 'Highlight atoms matching a boolean formula over per-atom properties. '
            + 'Example: "Position.X > 10 && StructureType == 2". The match count is returned.',
        parameters: typia.llm.parameters<PushExpressionSelectInput>(),
        validate: typia.createValidate<PushExpressionSelectInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    pushExpressionSelect(): void {}

    @BrowserAITool({
        name: 'launch_grain_segmentation_analysis',
        description: 'Add a grain-segmentation stage, with the given dislocation-density threshold, to the analysis pipeline '
            + 'of the trajectory open in the viewer. It does not run anything: the user runs the pipeline from the canvas.',
        parameters: typia.llm.parameters<LaunchGrainSegmentationAnalysisInput>(),
        validate: typia.createValidate<LaunchGrainSegmentationAnalysisInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    launchGrainSegmentation(): void {}
}
