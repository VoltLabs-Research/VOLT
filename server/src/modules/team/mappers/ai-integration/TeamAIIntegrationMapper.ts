import TeamAIIntegration, { TeamAIIntegrationProps } from '@modules/team/entities/ai-integration/TeamAIIntegration';
import { TeamAIIntegrationDocument } from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamAIIntegration, TeamAIIntegrationProps, TeamAIIntegrationDocument>(TeamAIIntegration, ['team', 'createdBy']);
