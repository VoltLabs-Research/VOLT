export interface ExposureMetaProps{
    plugin: string;
    trajectory: string;
    analysis: string;
    exposureId: string;
    timestep: number;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
};

export default class ExposureMeta{
    constructor(
        public id: string,
        public props: ExposureMetaProps
    ){}
};