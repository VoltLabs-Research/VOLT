import ProvisionDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/ProvisionDemoTeamClusterUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(ProvisionDemoTeamClusterUseCase, {
    statusCode: HttpStatus.Created
});
