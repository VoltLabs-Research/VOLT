export interface SubListingRowProps {
    plugin: string;
    team: string;
    trajectory: string;
    analysis: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    row: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

export default class SubListingRow {
    constructor(
        public _id: string,
        public props: SubListingRowProps
    ) {}

    get id(): string {
        return this._id;
    }
};
