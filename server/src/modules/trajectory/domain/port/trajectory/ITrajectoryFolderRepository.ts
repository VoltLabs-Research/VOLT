import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type TrajectoryFolder from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import type { TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';

export interface ITrajectoryFolderRepository extends ICatalogFolderRepository<TrajectoryFolder, TrajectoryFolderProps> {}
