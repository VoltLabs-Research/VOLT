import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '../../dtos/listing-row/GetPluginListingDocumentsDTO';

export interface IPluginListingService {
    getListingDocuments(pluginSlug: string, listingSlug: string, options: any): Promise<any>;
}

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO> {
    constructor(
        @inject('IPluginListingService') private listingService: IPluginListingService
    ) { }

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.getListingDocuments(
            input.pluginSlug,
            input.listingSlug,
            { page: input.page || 1, limit: input.limit || 50 }
        );

        return Result.ok(result);
    }
}
