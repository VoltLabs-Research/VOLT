import CreateTeamClusterRemoteAccessSessionUseCase from '@modules/cluster/application/use-cases/CreateTeamClusterRemoteAccessSessionUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateTeamClusterRemoteAccessSessionUseCase);
