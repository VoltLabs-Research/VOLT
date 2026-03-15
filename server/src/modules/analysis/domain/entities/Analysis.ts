export type AnalysisConfig = Record<string, unknown>;

export interface AnalysisProps {
    plugin: string;
    pluginDisplayName: string;
    teamCluster?: string;
    config: AnalysisConfig;
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
    ) {}

    get id(): string {
        return this._id;
    }
};
