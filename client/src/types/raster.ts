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