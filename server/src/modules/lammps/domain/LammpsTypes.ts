export enum LammpsContainerStatus {
    Provisioning = 'provisioning',
    Ready = 'ready',
    Failed = 'failed',
    Deleting = 'deleting'
}

export enum LammpsExecutionStatus {
    Pending = 'pending',
    Starting = 'starting',
    Created = 'created',
    Running = 'running',
    Stopping = 'stopping',
    Killing = 'killing',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled'
}

export enum LammpsDumpStatus {
    Ready = 'ready',
    Failed = 'failed'
}

export interface LammpsSimulationCell {
    boundingBox?: {
        width: number;
        height: number;
        length: number;
    };
    geometry?: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: {
            x: boolean;
            y: boolean;
            z: boolean;
        };
    };
}
