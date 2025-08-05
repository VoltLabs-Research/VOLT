export interface TrajectoryData{
    _id: string;
    name: string;
    dislocations?: DislocationData[];
    timesteps?: number[];
    metadata?: Record<string, any>;
}

export interface DislocationData {
    timestep: number;
    segments: any[];
    metadata?: Record<string, any>;
}

export interface EditorWidgetsProps {
    trajectory: TrajectoryData | null;
    currentTimestep: number | undefined;
}

export interface Scene3DContainerProps {
    trajectoryId: string | undefined;
    hasModel: boolean;
    onTrajectoryUpload: (trajectory: TrajectoryData) => void;
}