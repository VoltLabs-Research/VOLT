import TeamAIIntegration, { TeamAIIntegrationProps } from '@modules/team/domain/entities/TeamAIIntegration';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { TeamAIIntegrationDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamAIIntegrationModel';

class TeamAIIntegrationMapper extends BaseMapper<TeamAIIntegration, TeamAIIntegrationProps, TeamAIIntegrationDocument> {
    constructor() {
        super(TeamAIIntegration, ['team', 'createdBy']);
    }
}

export default new TeamAIIntegrationMapper();
