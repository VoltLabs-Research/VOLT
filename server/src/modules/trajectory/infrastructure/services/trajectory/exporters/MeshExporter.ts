import { ErrorCodes } from '@core/constants/error-codes';
import { DefectMeshExportOptions, Mesh, IMeshExporter } from '@modules/trajectory/domain/port/trajectory/exporters/MeshExporter';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class MeshExporter implements IMeshExporter{
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ){}

    public async toStorage(
        mesh: Mesh, 
        objectName: string, 
        options: DefectMeshExportOptions = {}
    ): Promise<void>{
        throw new ApplicationError(
            ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED,
            'Mesh export requires a team cluster. No local native modules available.',
            501
        );
    }
};
