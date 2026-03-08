import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { IPluginListingService } from '@modules/plugin/domain/port/IPluginListingService';
import { toPluginListingOptions } from '@modules/plugin/application/use-cases/listing-row/toPluginListingOptions';

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
}
