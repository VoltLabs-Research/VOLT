import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { ListingRowByAnalysisData } from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';

interface PopulatedTrajectory {
    _id?: string;
    name?: string;
}

export const mapListingRowByAnalysis = (listingRow: ListingRow): ListingRowByAnalysisData => {
    const trajectory = listingRow.props.trajectory as string | PopulatedTrajectory;
    const trajectoryId = typeof trajectory === 'string'
        ? trajectory
        : String(trajectory?._id || '');
    const trajectoryName = typeof trajectory !== 'string' && typeof trajectory?.name === 'string'
        ? trajectory.name
        : listingRow.props.trajectoryName || '';

    return {
        _id: listingRow._id,
        plugin: String(listingRow.props.plugin),
        exposureId: listingRow.props.exposureId,
        exposureName: listingRow.props.exposureName,
        trajectory: trajectoryId,
        trajectoryName,
        timestep: listingRow.props.timestep,
        row: listingRow.props.row
    };
};
