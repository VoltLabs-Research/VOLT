import { ErrorCodes } from '@core/constants/error-codes';
import { IDislocationExporter, DislocationExportOptions } from '@modules/trajectory/domain/port/trajectory/exporters/DislocationExporter';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class DislocationExporter implements IDislocationExporter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ){}

    public async toStorage(
        data: any,
        objectName: string,
        options: DislocationExportOptions = {}
    ): Promise<void> {
        throw new ApplicationError(
            ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED,
            'Dislocation export requires a team cluster. No local native modules available.',
            501
        );
    }
};
