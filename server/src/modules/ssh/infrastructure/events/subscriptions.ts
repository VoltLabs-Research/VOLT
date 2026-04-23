import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import { deleteManyOnTeamDeleted, deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(SSHConnectionRepository);
deleteManyOnUserDeleted(SSHConnectionRepository);
