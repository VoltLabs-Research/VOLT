import GenerateTeamClusterInstallManifestUseCase from '@modules/team-cluster/application/use-cases/GenerateTeamClusterInstallManifestUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GenerateTeamClusterInstallManifestUseCase);
