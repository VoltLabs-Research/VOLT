export interface ListingRowProps{
    plugin: string;
    listingSlug: string;
    exposureId: string;
    team: string;
    trajectory: string;
    analysis: string;
    timestep: number;
    row: any;
    trajectoryName: string;
    createdAt: Date;
    updatedAt: Date;
};

export default class ListingRow{
    constructor(
        public id: string,
        public props: ListingRowProps
    ){}
};