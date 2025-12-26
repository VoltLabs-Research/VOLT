import type { IconType } from 'react-icons/lib';
import { type User } from '@/types/models';

export interface Scene {
    frame: number;
    model: string;
    data?: string;
    analysisId?: string;
    isLoading?: boolean;
    isUnavailable?: boolean;
}

export interface FrameObject {
    [modelName: string]: Scene;
}

export interface MetricEntry {
    key: string;
    label: string;
    value: string | number;
    icon: IconType;
}

export interface PlaybackControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
}

export interface AnalysisSelectProps {
    analysesNames: {
        _id: string;
        name: string;
        description?: string;
        RMSD?: number;
        maxTrialCircuitSize?: number;
        circuitStretchability?: number;
    }[];
    selectedAnalysis: string | null;
    onAnalysisChange: (id: string | null) => void;
    isLoading?: boolean;
}

export interface ModelRailProps {
    modelsForCurrentFrame: Scene[];
    selectedModel: string;
    onModelChange: (model: string) => void;
}

export interface RasterSceneProps {
    scene: Scene | null;
    trajectoryId?: string;
    disableAnimation?: boolean;
    isLoading?: boolean;
    playbackControls: PlaybackControlsProps;
    analysisSelect: AnalysisSelectProps;
    modelRail: ModelRailProps;
}

export interface HeaderProps {
    trajectory: any;
    isLoading: boolean;
    onGoBack: () => void;
    onView3D: () => void;
    onSignIn?: () => void;
    connectedUsers?: User[];
}

export interface ThumbnailsProps {
    timeline: number[];
    selectedFrameIndex: number;
    isPlaying: boolean;
    isLoading: boolean;
    onThumbnailClick: (index: number) => void;
    getThumbnailScene: (timestep: number) => Scene | null;
}



export interface ThumbnailItemProps {
    scene: Scene;
    timestep: number;
    index: number;
    isActive: boolean;
    isPlaying: boolean;
    selectedFrameIndex: number;
    onClick: (index: number) => void;
}

export interface SceneColumnProps {
    trajectoryId?: string;
    scene: Scene | null;
    isPlaying: boolean;
    isLoading: boolean;
    playbackControls: PlaybackControlsProps;
    analysisSelect: AnalysisSelectProps;
    modelRail: ModelRailProps;
    delay?: number;
}

// Minimal types to satisfy imports from trajectory store types.
// These can be expanded later if raster pagination/querying is implemented.
export interface RasterQuery {
    page?: number;
    pageSize?: number;
    analysisId?: string;
    model?: string;
    frames?: number[];
}

export interface RasterPage {
    page: number;
    pageSize: number;
    total: number;
    // Map of timestep -> metadata(e.g., available models)
    frames: Record<string, any>;
}
