import type { tags } from 'typia';

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
    destination: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
}

export interface OpenInViewerInput{
    trajectoryId: string;
    analysisId?: string;
    ownerId?: string;
}

export interface SwitchTeamInput{
    teamId: string;
}

export interface OpenCommandPaletteInput{
    action: 'open' | 'close' | 'toggle';
}

export interface OpenPanelInput{
    sidebarOption?: string;
    modifier?: string;
}

export interface SetChatSurfaceInput{
    surface: 'floating' | 'page' | 'hidden';
}

export interface FocusResultInput{
    modifierId: string | null;
}

export interface SetCameraViewInput{
    view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';
}

export interface SetPlaybackInput{
    speed?: number & tags.Minimum<0.1> & tags.Maximum<10>;
    targetFps?: number;
    rangeStart?: number;
    rangeEnd?: number;
}

export interface ControlPlaybackInput{
    action: 'play' | 'pause' | 'stop';
}

export interface SeekFrameInput{
    frame?: number;
    position?: 'first' | 'last' | 'next' | 'previous';
}

export interface SetAppearanceInput{
    pointSize?: number & tags.Minimum<0.1> & tags.Maximum<5>;
    showSimulationCell?: boolean;
    quality?: 'ultra' | 'high' | 'balanced' | 'performance' | 'battery';
}

export interface SetEnvironmentInput{
    backgroundColor?: string;
    grid?: {
        enabled?: boolean;
    };
    fog?: {
        enableFog?: boolean;
        fogColor?: string;
        fogNear?: number;
        fogFar?: number;
    };
}

export interface SetVisibleLayersInput{
    layer: string;
    visible: boolean;
}

export interface SetThemeInput{
    theme: 'light' | 'dark' | 'system';
}

export interface ResetViewSettingsInput{
    action: 'undo' | 'redo' | 'reset_all';
}

export interface ConfigureColorCodingInput{
    property: string;
    colorMap?: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cool' | 'warm' | 'rainbow' | 'jet';
    min?: number;
    max?: number;
}

export interface PushExpressionSelectInput{
    formula: string;
    description?: string;
}

export interface LaunchGrainSegmentationAnalysisInput{
    dislocation_density_threshold: number & tags.Minimum<0> & tags.Maximum<1>;
    frame?: number & tags.Type<'int64'> & tags.Minimum<0> & tags.Maximum<9007199254740991>;
}
