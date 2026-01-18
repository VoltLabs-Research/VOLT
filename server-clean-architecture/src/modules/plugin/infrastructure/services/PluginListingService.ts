import { injectable, inject } from 'tsyringe';
import { IStorageService } from '@shared/domain/ports/IStorageService';

import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

@injectable()
export class PluginListingService {
    constructor(
        @inject(SHARED_TOKENS.StorageService) private storage: IStorageService
    ){}

    async getExposureGLB(exposureId: string, timestep: number): Promise<any> {
        const path = `exposures/${exposureId}/glb/${timestep}.glb`;
        return this.storage.getStream('plugins', path);
    }

    async getExposureChart(exposureId: string, timestep: number): Promise<any> {
        const path = `exposures/${exposureId}/chart/${timestep}.json`;
        return this.storage.getStream('plugins', path);
    }

    async getListingDocuments(pluginSlug: string, listingSlug: string, options: any): Promise<any> {
        // Query database for listing documents with pagination
        return {
            documents: [],
            total: 0,
            page: options.page || 1,
            limit: options.limit || 50
        };
    }
}
