import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { AtomsGroupedByType, IAtomisticExporter } from '@modules/trajectory/domain/port/trajectory/exporters/AtomisticExporter';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { inject, injectable } from 'tsyringe';

@injectable()
export default class AtomisticExporter implements IAtomisticExporter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) { }

    public async toStorage(filePath: string, objectName: string): Promise<void> {
        throw new ApplicationError(
            ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED,
            'GLB export requires a team cluster. No local native modules available.',
            501
        );
    }

    public async exportColoredByProperty(
        filePath: string,
        objectName: string,
        property: string,
        startValue: number,
        endValue: number,
        gradientName: string,
        externalValues?: Float32Array,
        teamClusterId?: string,
        trajectoryId?: string,
        timestep?: number
    ): Promise<void> {
        if (!teamClusterId || !trajectoryId || timestep === undefined) {
            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED,
                'Color-coded export requires a team cluster. No local native modules available.',
                501
            );
        }

        await this.trajectoryNativeDaemonService.exportColoredModel({
            teamClusterId,
            trajectoryId,
            timestep,
            property,
            startValue,
            endValue,
            gradient: gradientName,
            objectKey: objectName,
            externalValues
        });
    }

    public async exportAtomsTypeToGLBBuffer(atomsByType: AtomsGroupedByType, objectName: string): Promise<void> {
        throw new ApplicationError(
            ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED,
            'Atoms-by-type GLB export requires a team cluster. No local native modules available.',
            501
        );
    }
};
