export interface AnalysisProps{
    plugin: string;
    clusterId: string;
    config: any;
    trajectory: string;
    createdBy: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
};

export default class Analysis{
    constructor(
        public id: string,
        public props: AnalysisProps
    ){}
};