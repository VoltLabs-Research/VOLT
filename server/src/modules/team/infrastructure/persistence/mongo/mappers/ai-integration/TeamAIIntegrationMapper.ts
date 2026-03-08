import TeamAIIntegration, { TeamAIIntegrationProps } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import { TeamAIIntegrationDocument } from '@modules/team/infrastructure/persistence/mongo/models/ai-integration/TeamAIIntegrationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamAIIntegration, TeamAIIntegrationProps, TeamAIIntegrationDocument>(TeamAIIntegration, ['team', 'createdBy']);
