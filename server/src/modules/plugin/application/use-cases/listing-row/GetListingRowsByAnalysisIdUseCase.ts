import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';

@injectable()
export class GetListingRowsByAnalysisIdUseCase implements IUseCase<GetListingRowsByAnalysisIdInputDTO, GetListingRowsByAnalysisIdOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository
    ) {}

    async execute(input: GetListingRowsByAnalysisIdInputDTO): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
        const sortAsc = input.sortAsc ?? false;

        const result = await this.listingRowRepository.findAll({
            filter: {
                analysis: input.analysisId,
                team: input.teamId
            } as any,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        const data = result.data.map((listingRow): ListingRowByAnalysisData => {
            const trajectory = listingRow.props.trajectory as any;
            const trajectoryId = typeof trajectory === 'string'
                ? trajectory
                : String(trajectory?._id || trajectory?.id || '');
            const trajectoryName = typeof trajectory?.name === 'string'
                ? trajectory.name
                : listingRow.props.trajectoryName || '';

            return {
                _id: listingRow.id,
                plugin: String(listingRow.props.plugin),
                exposureId: listingRow.props.exposureId,
                exposureName: listingRow.props.exposureName,
                trajectory: trajectoryId,
                trajectoryName,
                timestep: listingRow.props.timestep,
                row: listingRow.props.row
            };
        });

        return Result.ok({
            ...result,
            data
        });
    }
};
