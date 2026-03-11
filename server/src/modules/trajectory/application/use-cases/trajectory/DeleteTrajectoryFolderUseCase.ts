import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTrajectoryFolderUseCase extends DeleteCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps, Trajectory, TrajectoryProps> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
        trajectoryFolderRepository: ITrajectoryFolderRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        trajectoryRepository: ITrajectoryRepository,
        @inject(DeleteTrajectoryByIdUseCase)
        deleteTrajectoryByIdUseCase: DeleteTrajectoryByIdUseCase
    ) {
        super(
            trajectoryFolderRepository,
            trajectoryRepository,
            async (trajectory) => {
                const result = await deleteTrajectoryByIdUseCase.execute({
                    trajectoryId: trajectory._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'Trajectory folder' }
        );
    }
}
