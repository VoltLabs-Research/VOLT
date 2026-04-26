import RegenerateTeamClusterEnrollmentTokenUseCase from '@modules/cluster/application/use-cases/RegenerateTeamClusterEnrollmentTokenUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(RegenerateTeamClusterEnrollmentTokenUseCase);
