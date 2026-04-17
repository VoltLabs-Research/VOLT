import RevealTeamClusterCredentialsUseCase from '@modules/team-cluster/application/use-cases/RevealTeamClusterCredentialsUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(RevealTeamClusterCredentialsUseCase);
