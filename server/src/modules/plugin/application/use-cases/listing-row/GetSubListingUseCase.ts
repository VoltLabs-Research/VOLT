import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/ISubListingRowRepository';
import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';

@injectable()
export class GetSubListingUseCase implements IUseCase<GetSubListingInputDTO, GetSubListingOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.SubListingRowRepository)
        private subListingRowRepository: ISubListingRowRepository
    ) {}

    async execute(input: GetSubListingInputDTO): Promise<Result<GetSubListingOutputDTO>> {
        const page = Math.max(1, Number(input.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));

        const result = await this.subListingRowRepository.findAll({
            filter: {
                analysis: input.analysisId,
                exposureId: input.exposureId,
                timestep: Number(input.timestep),
                subListingName: input.subListingName
            },
            page,
            limit,
            sort: {
                _id: 1
            }
        });

        const rows = result.data.map((document) => document.props.row);

        let columns: SubListingColumn[] = [];
        if (rows.length > 0) {
            columns = Object.keys(rows[0]).map((key) => ({
                label: key,
                sortable: true
            }));
        }

        return Result.ok({
            subListingName: input.subListingName,
            columns,
            rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit
        });
    }
}
