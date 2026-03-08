export interface AnalysisProps {
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
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export default class Analysis {
    constructor(
        public readonly _id: string,
        public props: AnalysisProps
    ){}

    get id(): string {
        return this._id;
    }
};
