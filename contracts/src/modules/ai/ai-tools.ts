import { z } from 'zod';

export const noParamsSchema = z.object({});

export const listConversationsSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50)
});

export const updateConversationSchema = z.object({
    conversationId: z.string(),
    title: z.string().optional()
});

export const deleteConversationSchema = z.object({
    conversationId: z.string()
});

export const navigateToSchema = z.object({
    destination: z.string().describe(
        'Logical destination key. One of: dashboard_home, trajectories_list, trajectory_artifacts, '
        + 'trajectory_atoms, simulation_cells, analysis_configs, analysis_sub_listings, plugins_list, '
        + 'plugin_builder, plugin_exposure_listing, trajectory_plugin_exposure_listing, clusters_list, '
        + 'cluster_monitoring, containers_list, container_create, container_details, messages, '
        + 'ai_conversation, latex_list, latex_workspace, notebooks, whiteboards, whiteboard_editor, '
        + 'my_team, manage_roles, secret_keys, secret_key_metrics, settings_general, '
        + 'settings_authentication, settings_theme, settings_integrations, settings_sessions.'
    ),
    params: z.record(z.string(), z.string()).optional().describe(
        'Entity ids the destination requires, e.g. { trajectoryId, analysisId, pluginId, exposureId, '
        + 'clusterId, containerId, documentId, whiteboardId, secretKeyId, conversationId, chatId }. '
        + 'Resolve real ids with global_search or list_* tools first — never invent them.'
    ),
    query: z.record(z.string(), z.string()).optional().describe('Optional query string params, e.g. { tab: "terminal" }.')
});

export const openInViewerSchema = z.object({
    trajectoryId: z.string().describe(
        'Id of the trajectory to open in the 3D viewer. Resolve a real id with global_search / '
        + 'list_* first — never invent it.'
    ),
    analysisId: z.string().optional().describe(
        'Optional analysis configuration id to focus once the viewer opens (added as the ?analysis query param).'
    ),
    ownerId: z.string().optional().describe(
        'Optional collaborator/owner id to open the trajectory inside that user\'s workspace.'
    )
});

export const switchTeamSchema = z.object({
    teamId: z.string().describe(
        'Id of the team to switch into. Resolve a real id with global_search / list_* first — never invent it.'
    )
});

export const openCommandPaletteSchema = z.object({
    action: z.enum(['open', 'close', 'toggle']).describe(
        'What to do with the command palette: open it, close it, or toggle its visibility.'
    )
});

export const openPanelSchema = z.object({
    sidebarOption: z.string().optional().describe(
        'Sidebar panel to open in the viewer editor (e.g. the appearance/camera/lights/effects panel key).'
    ),
    modifier: z.string().optional().describe(
        'Active modifier/tool key to select within the editor (e.g. a slice plane or analysis modifier).'
    )
});

export const setChatSurfaceSchema = z.object({
    surface: z.enum(['floating', 'page', 'hidden']).describe(
        'Where to put the assistant: "floating" opens the chat widget overlay, "page" navigates to the full '
        + 'AI page, "hidden" closes the floating widget.'
    )
});

export const focusResultSchema = z.object({
    modifierId: z
        .string()
        .nullable()
        .describe(
            'The id of the modifier/result to focus and highlight in the UI, or null to clear the current focus. '
            + 'Resolve a real modifier id from the trajectory analysis configuration first — never invent one.'
        )
});

export const setCameraViewSchema = z.object({
    view: z
        .enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric'])
        .describe(
            'Named camera viewpoint to snap to. front/back look along the Y axis, left/right along X, '
            + 'top/bottom along the Z (up) axis, and isometric is a 3/4 corner view. The camera always '
            + 'targets the scene origin.'
        )
});

export const setPlaybackSchema = z.object({
    speed: z.number().min(0.1).max(10).optional().describe(
        'Playback speed multiplier, clamped to [0.1, 10]. 1 is the baseline rate; '
        + 'higher values advance through frames faster.'
    ),
    targetFps: z.number().optional().describe(
        'Target frames-per-second for the playback clock at 1x speed (positive number). '
        + 'The baseline default is 10 fps.'
    ),
    rangeStart: z.number().optional().describe(
        'Start boundary (timestep value) of the playback loop range. Frames before this are skipped.'
    ),
    rangeEnd: z.number().optional().describe(
        'End boundary (timestep value) of the playback loop range. Frames after this are skipped.'
    )
});

export const controlPlaybackSchema = z.object({
    action: z.enum(['play', 'pause', 'stop']).describe(
        'Playback action for the trajectory animation in the 3D viewer. '
        + '"play" starts/resumes frame animation, "pause" halts it in place, '
        + '"stop" halts animation (both pause and stop end the playback loop).'
    )
});

export const seekFrameSchema = z.object({
    frame: z.number().optional().describe(
        'Exact timestep value to jump to (NOT the frame index). Must be one of the trajectory\'s '
        + 'timesteps; if it does not match exactly the viewer clamps to the nearest valid timestep. '
        + 'Use list/inspection tools to discover real timesteps when unsure.'
    ),
    position: z.enum(['first', 'last', 'next', 'previous']).optional().describe(
        'Relative jump instead of an exact timestep. "first"/"last" go to the timeline ends; '
        + '"next"/"previous" step one frame from the current timestep. Ignored if `frame` is provided.'
    )
});

export const setAppearanceSchema = z.object({
    pointSize: z.number().min(0.1).max(5).optional().describe(
        'Point-size multiplier for the atomistic point cloud (0.1–5.0, default 1.0). Larger = bigger atoms.'
    ),
    showSimulationCell: z.boolean().optional().describe('Whether to render the simulation cell bounding box.'),
    quality: z.enum(['ultra', 'high', 'balanced', 'performance', 'battery']).optional().describe(
        'Render-quality preset. "ultra"/"high" favor visual fidelity, "performance"/"battery" favor framerate.'
    )
});

export const setEnvironmentSchema = z.object({
    backgroundColor: z.string().optional().describe('Scene background color as a hex string, e.g. "#070708".'),
    grid: z.object({
        enabled: z.boolean().optional().describe('Whether the reference floor grid is visible.')
    }).optional().describe('Reference-grid settings.'),
    fog: z.object({
        enableFog: z.boolean().optional().describe('Whether distance fog is enabled.'),
        fogColor: z.string().optional().describe('Fog color as a hex string.'),
        fogNear: z.number().optional().describe('Distance at which fog begins.'),
        fogFar: z.number().optional().describe('Distance at which fog is fully opaque.')
    }).optional().describe('Distance-fog settings.')
});

export const setVisibleLayersSchema = z.object({
    layer: z.string().describe(
        'Which scene layer to toggle. Use "atoms" (a.k.a. "particles"/"trajectory"/"default") for the base '
        + 'atomistic point cloud — the only layer that can be safely added/removed without analysis context. '
        + 'Other layers (plugin analysis overlays, color-coding, filters, line styles) are managed elsewhere '
        + 'and are not addressable here.'
    ),
    visible: z.boolean().describe('true to show the layer, false to hide it.')
});

export const setThemeSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).describe(
        'Theme preference to apply. "system" follows the OS color-scheme preference.'
    )
});

export const resetViewSettingsSchema = z.object({
    action: z.enum(['undo', 'redo', 'reset_all']).describe(
        '"undo" reverts the last view change, "redo" reapplies it, "reset_all" restores every viewer setting '
        + '(camera, lights, effects, grid, environment, point size, …) to defaults.'
    )
});

export const configureColorCodingSchema = z.object({
    property: z.string().describe('Per-atom property name to color by (e.g. "StructureType", "Epot", "cluster_id").'),
    colorMap: z.enum(['viridis', 'plasma', 'inferno', 'magma', 'cool', 'warm', 'rainbow', 'jet']).optional()
        .describe('Color map name. Defaults to "viridis".'),
    min: z.number().optional().describe('Minimum value for the color scale. Omit to auto-scale.'),
    max: z.number().optional().describe('Maximum value for the color scale. Omit to auto-scale.')
});

export const pushExpressionSelectSchema = z.object({
    formula: z.string().describe(
        'Boolean expression over per-atom properties (e.g. "Position.X > 10", "StructureType == 1"). '
        + 'Atoms matching the formula are selected/highlighted.'
    ),
    description: z.string().optional().describe('Human-readable label for this selection.')
});

export const launchGrainSegmentationAnalysisSchema = z.object({
    dislocation_density_threshold: z.number().min(0).max(1).describe(
        'Dislocation density threshold (0–1). Segments with density below this are excluded from the export.'
    ),
    frame: z.number().int().min(0).optional().describe('Frame index to analyze. Defaults to current frame.')
});

export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type DeleteConversationInput = z.infer<typeof deleteConversationSchema>;
export type NavigateToInput = z.infer<typeof navigateToSchema>;
export type OpenInViewerInput = z.infer<typeof openInViewerSchema>;
export type SwitchTeamInput = z.infer<typeof switchTeamSchema>;
export type OpenCommandPaletteInput = z.infer<typeof openCommandPaletteSchema>;
export type OpenPanelInput = z.infer<typeof openPanelSchema>;
export type SetChatSurfaceInput = z.infer<typeof setChatSurfaceSchema>;
export type FocusResultInput = z.infer<typeof focusResultSchema>;
export type SetCameraViewInput = z.infer<typeof setCameraViewSchema>;
export type SetPlaybackInput = z.infer<typeof setPlaybackSchema>;
export type ControlPlaybackInput = z.infer<typeof controlPlaybackSchema>;
export type SeekFrameInput = z.infer<typeof seekFrameSchema>;
export type SetAppearanceInput = z.infer<typeof setAppearanceSchema>;
export type SetEnvironmentInput = z.infer<typeof setEnvironmentSchema>;
export type SetVisibleLayersInput = z.infer<typeof setVisibleLayersSchema>;
export type SetThemeInput = z.infer<typeof setThemeSchema>;
export type ResetViewSettingsInput = z.infer<typeof resetViewSettingsSchema>;
export type ConfigureColorCodingInput = z.infer<typeof configureColorCodingSchema>;
export type PushExpressionSelectInput = z.infer<typeof pushExpressionSelectSchema>;
export type LaunchGrainSegmentationAnalysisInput = z.infer<typeof launchGrainSegmentationAnalysisSchema>;
