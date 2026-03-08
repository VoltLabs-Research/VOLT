import { mapListingRowByAnalysis } from '@modules/plugin/utilities/mappers/listing-row/mapListingRowByAnalysis';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { IListingRowRepository } from '@modules/plugin/domain/port/listing-row/IListingRowRepository';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

interface ListingRowsByAnalysisFilter {
    analysis: string;
    team: string;
};

const buildListingRowsByAnalysisFilter = (
    input: GetListingRowsByAnalysisIdInputDTO
): ListingRowsByAnalysisFilter => {
    return {
        analysis: input.analysisId,
        team: input.teamId
    };
};

@injectable()
export class GetListingRowsByAnalysisIdUseCase implements IUseCase<GetListingRowsByAnalysisIdInputDTO, GetListingRowsByAnalysisIdOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository
    ) {}

    async execute(input: GetListingRowsByAnalysisIdInputDTO): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
        const sortAsc = input.sortAsc ?? false;
        const filter = buildListingRowsByAnalysisFilter(input);

        const result = await this.listingRowRepository.findAll({
            filter,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        const data = result.data.map(mapListingRowByAnalysis);

        return Result.ok({
            ...result,
            data
        });
    }
};
