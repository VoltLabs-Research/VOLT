import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { toPluginListingOptions } from '@modules/plugin/utilities/listing-row/toPluginListingOptions';
import { IPluginListingService } from '@modules/plugin/domain/port/listing-row/IPluginListingService';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService)
        private readonly listingService: IPluginListingService
    ){}

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.getListingDocuments(
            input.pluginId,
            {
                ...toPluginListingOptions(input),
                page: input.page ?? 1,
                limit: input.limit ?? 50
            }
        );

        return Result.ok(result);
    }
};
