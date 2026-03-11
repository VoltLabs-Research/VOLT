import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTrajectoryFolderUseCase extends DeleteCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps, TrajectoryProps> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
        trajectoryFolderRepository: ITrajectoryFolderRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        trajectoryRepository: ITrajectoryRepository
    ) {
        super(trajectoryFolderRepository, trajectoryRepository, { folderLabel: 'Trajectory folder' });
    }
}
