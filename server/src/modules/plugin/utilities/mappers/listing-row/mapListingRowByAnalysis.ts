import { ListingRowByAnalysisData } from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import ListingRow from '@modules/plugin/domain/entities/listing-row/ListingRow';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';

export const mapListingRowByAnalysis = (listingRow: ListingRow): ListingRowByAnalysisData => {
    const trajectory = listingRow.props.trajectory;
    const trajectoryRecord = asRecord(trajectory);
    let trajectoryId = '';

    if (typeof trajectory === 'string') {
        trajectoryId = trajectory;
    } else if (trajectoryRecord && trajectoryRecord._id !== undefined) {
        trajectoryId = String(trajectoryRecord._id);
    }

    let trajectoryName = listingRow.props.trajectoryName || '';
    if (trajectoryRecord && typeof trajectoryRecord.name === 'string') {
        trajectoryName = trajectoryRecord.name;
    }

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
