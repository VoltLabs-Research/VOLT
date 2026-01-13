export enum ContextSource{
    TrajectoryDumps = 'trajectory-dumps'
};

export interface ContextNodeData{
    source: ContextSource;
};