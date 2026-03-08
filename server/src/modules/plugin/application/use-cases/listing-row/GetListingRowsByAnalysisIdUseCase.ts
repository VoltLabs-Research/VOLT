import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { IListingRowRepository } from '@modules/plugin/domain/port/IListingRowRepository';
import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { mapListingRowByAnalysis } from './mapListingRowByAnalysis';

interface ListingRowsByAnalysisFilter {
    analysis: string;
    team: string;
}

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
            } as ListingRowsByAnalysisFilter,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        const data = result.data.map((listingRow) => mapListingRowByAnalysis(listingRow));

        return Result.ok({
            ...result,
            data
        });
    }
};
