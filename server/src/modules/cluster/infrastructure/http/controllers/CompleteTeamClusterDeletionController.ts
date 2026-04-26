import CompleteTeamClusterDeletionUseCase from '@modules/cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CompleteTeamClusterDeletionUseCase);
