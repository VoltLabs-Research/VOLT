import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { ITrajectoryFolderRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFolderRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateTrajectoryFolderUseCase extends CreateCatalogFolderUseCase<TrajectoryFolder, TrajectoryFolderProps> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryFolderRepository)
        trajectoryFolderRepository: ITrajectoryFolderRepository
    ) {
        super(trajectoryFolderRepository, { folderLabel: 'Trajectory folder' });
    }
}
