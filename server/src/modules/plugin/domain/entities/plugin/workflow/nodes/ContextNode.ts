export enum ContextSource {
    TrajectoryDumps = 'trajectory_dumps'
};

export interface ContextNodeData {
    source: ContextSource;
};