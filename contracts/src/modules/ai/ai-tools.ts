import type { tags } from 'typia';

// Marker type for tools the model calls with no arguments. Deliberately NOT a
// JSDoc block: typia would lift it into the tool's parameter-schema description.
export interface NoParamsInput{}

export interface ListConversationsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
}

export interface UpdateConversationInput{
    conversationId: string;
    title?: string;
}

export interface DeleteConversationInput{
    conversationId: string;
}

export interface NavigateToInput{
    /**
     * Logical destination key. One of: dashboard_home, trajectories_list, trajectory_artifacts, trajectory_atoms, simulation_cells, analysis_configs, analysis_sub_listings, plugins_list, plugin_builder, plugin_exposure_listing, trajectory_plugin_exposure_listing, clusters_list, cluster_monitoring, containers_list, container_create, container_details, ai_conversation, notebooks, whiteboards, whiteboard_editor, my_team, manage_roles, secret_keys, secret_key_metrics, settings_general, settings_authentication, settings_theme, settings_integrations, settings_sessions.
     */
    destination: string;
    /**
     * Entity ids the destination requires, e.g. { trajectoryId, analysisId, pluginId, exposureId, clusterId, containerId, documentId, whiteboardId, secretKeyId, conversationId }. Resolve real ids with global_search or list_* tools first — never invent them.
     */
    params?: Record<string, string>;
    /**
     * Optional query string params, e.g. { tab: "terminal" }.
     */
    query?: Record<string, string>;
}

export interface OpenInViewerInput{
    /**
     * Id of the trajectory to open in the 3D viewer. Resolve a real id with global_search / list_* first — never invent it.
     */
    trajectoryId: string;
    /**
     * Optional analysis configuration id to focus once the viewer opens (added as the ?analysis query param).
     */
    analysisId?: string;
    /**
     * Optional collaborator/owner id to open the trajectory inside that user's workspace.
     */
    ownerId?: string;
}

export interface SwitchTeamInput{
    /**
     * Id of the team to switch into. Resolve a real id with global_search / list_* first — never invent it.
     */
    teamId: string;
}

export interface OpenCommandPaletteInput{
    /**
     * What to do with the command palette: open it, close it, or toggle its visibility.
     */
    action: 'open' | 'close' | 'toggle';
}

export interface OpenPanelInput{
    /**
     * Sidebar panel to open in the viewer editor (e.g. the appearance/camera/lights/effects panel key).
     */
    sidebarOption?: string;
    /**
     * Active modifier/tool key to select within the editor (e.g. a slice plane or analysis modifier).
     */
    modifier?: string;
}

export interface SetChatSurfaceInput{
    /**
     * Where to put the assistant: "floating" opens the chat widget overlay, "page" navigates to the full AI page, "hidden" closes the floating widget.
     */
    surface: 'floating' | 'page' | 'hidden';
}

export interface FocusResultInput{
    /**
     * The id of the modifier/result to focus and highlight in the UI, or null to clear the current focus. Resolve a real modifier id from the trajectory analysis configuration first — never invent one.
     */
    modifierId: string | null;
}

export interface SetCameraViewInput{
    /**
     * Named camera viewpoint to snap to. front/back look along the Y axis, left/right along X, top/bottom along the Z (up) axis, and isometric is a 3/4 corner view. The camera always targets the scene origin.
     */
    view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';
}

export interface SetPlaybackInput{
    /**
     * Playback speed multiplier, clamped to [0.1, 10]. 1 is the baseline rate; higher values advance through frames faster.
     */
    speed?: number & tags.Minimum<0.1> & tags.Maximum<10>;
    /**
     * Target frames-per-second for the playback clock at 1x speed (positive number). The baseline default is 10 fps.
     */
    targetFps?: number;
    /**
     * Start boundary (timestep value) of the playback loop range. Frames before this are skipped.
     */
    rangeStart?: number;
    /**
     * End boundary (timestep value) of the playback loop range. Frames after this are skipped.
     */
    rangeEnd?: number;
}

export interface ControlPlaybackInput{
    /**
     * Playback action for the trajectory animation in the 3D viewer. "play" starts/resumes frame animation, "pause" halts it in place, "stop" halts animation (both pause and stop end the playback loop).
     */
    action: 'play' | 'pause' | 'stop';
}

export interface SeekFrameInput{
    /**
     * Exact timestep value to jump to (NOT the frame index). Must be one of the trajectory's timesteps; if it does not match exactly the viewer clamps to the nearest valid timestep. Use list/inspection tools to discover real timesteps when unsure.
     */
    frame?: number;
    /**
     * Relative jump instead of an exact timestep. "first"/"last" go to the timeline ends; "next"/"previous" step one frame from the current timestep. Ignored if `frame` is provided.
     */
    position?: 'first' | 'last' | 'next' | 'previous';
}

export interface SetAppearanceInput{
    /**
     * Point-size multiplier for the atomistic point cloud (0.1–5.0, default 1.0). Larger = bigger atoms.
     */
    pointSize?: number & tags.Minimum<0.1> & tags.Maximum<5>;
    /**
     * Whether to render the simulation cell bounding box.
     */
    showSimulationCell?: boolean;
    /**
     * Render-quality preset. "ultra"/"high" favor visual fidelity, "performance"/"battery" favor framerate.
     */
    quality?: 'ultra' | 'high' | 'balanced' | 'performance' | 'battery';
}

export interface SetEnvironmentInput{
    /**
     * Scene background color as a hex string, e.g. "#070708".
     */
    backgroundColor?: string;
    /**
     * Reference-grid settings.
     */
    grid?: {
        /**
         * Whether the reference floor grid is visible.
         */
        enabled?: boolean;
    };
    /**
     * Distance-fog settings.
     */
    fog?: {
        /**
         * Whether distance fog is enabled.
         */
        enableFog?: boolean;
        /**
         * Fog color as a hex string.
         */
        fogColor?: string;
        /**
         * Distance at which fog begins.
         */
        fogNear?: number;
        /**
         * Distance at which fog is fully opaque.
         */
        fogFar?: number;
    };
}

export interface SetVisibleLayersInput{
    /**
     * Which scene layer to toggle. Use "atoms" (a.k.a. "particles"/"trajectory"/"default") for the base atomistic point cloud — the only layer that can be safely added/removed without analysis context. Other layers (plugin analysis overlays, color-coding, filters, line styles) are managed elsewhere and are not addressable here.
     */
    layer: string;
    /**
     * true to show the layer, false to hide it.
     */
    visible: boolean;
}

export interface SetThemeInput{
    /**
     * Theme preference to apply. "system" follows the OS color-scheme preference.
     */
    theme: 'light' | 'dark' | 'system';
}

export interface ResetViewSettingsInput{
    /**
     * "undo" reverts the last view change, "redo" reapplies it, "reset_all" restores every viewer setting (camera, lights, effects, grid, environment, point size, …) to defaults.
     */
    action: 'undo' | 'redo' | 'reset_all';
}

export interface ConfigureColorCodingInput{
    /**
     * Per-atom property name to color by (e.g. "StructureType", "Epot", "cluster_id").
     */
    property: string;
    /**
     * Color map name. Defaults to "viridis".
     */
    colorMap?: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cool' | 'warm' | 'rainbow' | 'jet';
    /**
     * Minimum value for the color scale. Omit to auto-scale.
     */
    min?: number;
    /**
     * Maximum value for the color scale. Omit to auto-scale.
     */
    max?: number;
}

export interface PushExpressionSelectInput{
    /**
     * Boolean expression over per-atom properties (e.g. "Position.X > 10", "StructureType == 1"). Atoms matching the formula are selected/highlighted.
     */
    formula: string;
    /**
     * Human-readable label for this selection.
     */
    description?: string;
}

export interface LaunchGrainSegmentationAnalysisInput{
    /**
     * Dislocation density threshold (0–1). Segments with density below this are excluded from the export.
     */
    dislocation_density_threshold: number & tags.Minimum<0> & tags.Maximum<1>;
    /**
     * Frame index to analyze. Defaults to current frame.
     */
    frame?: number & tags.Type<'int64'> & tags.Minimum<0> & tags.Maximum<9007199254740991>;
}
