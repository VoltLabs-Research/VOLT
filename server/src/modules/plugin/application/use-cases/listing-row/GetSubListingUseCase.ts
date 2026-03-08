import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

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

        const rows = result.data.map((document) => ({
            _id: document._id,
            ...(document.props.row || {})
        }));

        let columns: SubListingColumn[] = [];
        if (result.data.length > 0) {
            columns = Object.keys(result.data[0].props.row || {}).map((key) => ({
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
};
