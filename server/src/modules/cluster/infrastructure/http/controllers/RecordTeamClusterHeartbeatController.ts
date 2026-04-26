import RecordTeamClusterHeartbeatUseCase from '@modules/cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(RecordTeamClusterHeartbeatUseCase);
