export interface ListingRowProps{
    plugin: string;
    exposureName: string;
    exposureId: string;
    team: string;
    trajectory: string;
    analysis: string;
    timestep: number;
    row: Record<string, unknown>;
    trajectoryName: string;
    subListingNames: string[];
    createdAt: Date;
    updatedAt: Date;
};

export default class ListingRow{
    constructor(
        public _id: string,
        public props: ListingRowProps
    ){}

    get id(): string {
        return this._id;
    }
};
