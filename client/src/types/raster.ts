import type { IconType } from 'react-icons/lib';

export interface Scene{
    frame: number;
    model: string;
    data: string;
}

export interface FrameObject{
    [modelName: string]: Scene;
}

export interface MetricEntry{
    key: string;
    label: string;
    value: string | number;
    icon: IconType;
}

export interface PlaybackControlsProps{
    isPlaying: boolean;
    onPlayPause: () => void;
}

export interface AnalysisSelectProps{
    analysesNames: { _id: string; name: string; }[];
    selectedAnalysis: string | null;
    onAnalysisChange: (id: string | null) => void;
    isLoading?: boolean;
}

export interface ModelRailProps{
    modelsForCurrentFrame: Scene[];
    selectedModel: string;
    onModelChange: (model: string) => void;
}

export interface RasterSceneProps{
    scene: Scene | null;
    disableAnimation?: boolean;
    isLoading?: boolean;
    playbackControls: PlaybackControlsProps;
    analysisSelect: AnalysisSelectProps;
    modelRail: ModelRailProps;
}

export interface HeaderProps{
    trajectory: any;
    isLoading: boolean;
    onGoBack: () => void;
    onView3D: () => void;
    onSignIn: () => void;
}

export interface ThumbnailsProps{
    timeline: number[];
    selectedFrameIndex: number;
    isPlaying: boolean;
    isLoading: boolean;
    onThumbnailClick: (index: number) => void;
    getThumbnailScene: (timestep: number) => Scene | null;
}

export interface MetricsBarProps{
    items: MetricEntry[];
    isLoading: boolean;
    showDislocations: boolean;
    onToggleDislocations: () => void;
}

export interface DislocationPanelProps{
    dislocationData: any;
    show: boolean;
    isLoading: boolean;
}

export interface ThumbnailItemProps{
    scene: Scene;
    timestep: number;
    index: number;
    isActive: boolean;
    isPlaying: boolean;
    selectedFrameIndex: number;
    onClick: (index: number) => void;
}

export interface SceneColumnProps{
    scene: Scene | null;
    dislocationData: any;
    isDislocationsLoading: boolean;
    showDislocations: boolean;
    isPlaying: boolean;
    isLoading: boolean;
    playbackControls: PlaybackControlsProps;
    analysisSelect: AnalysisSelectProps;
    modelRail: ModelRailProps;
    delay?: number;
}