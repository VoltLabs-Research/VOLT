import DeploymentSettings, {
    DeploymentSettingsProps
} from '@modules/system/domain/entities/DeploymentSettings';
import type { IDeploymentSettingsRepository } from '@modules/system/domain/port/IDeploymentSettingsRepository';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import deploymentSettingsMapper from '@modules/system/infrastructure/persistence/mongo/mappers/DeploymentSettingsMapper';
import DeploymentSettingsModel, {
    DeploymentSettingsDocument
} from '@modules/system/infrastructure/persistence/mongo/models/DeploymentSettingsModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@Singleton(SYSTEM_TOKENS.DeploymentSettingsRepository)
export default class DeploymentSettingsRepository
    extends MongooseBaseRepository<DeploymentSettings, DeploymentSettingsProps, DeploymentSettingsDocument>
    implements IDeploymentSettingsRepository {

    constructor() {
        super(DeploymentSettingsModel, deploymentSettingsMapper);
    }

    async getSettings(): Promise<DeploymentSettings> {
        const doc = await this.findOne({});
        return doc ?? new DeploymentSettings('', {
            defaultTeam: null,
            autoJoinNewMembers: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    async setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings> {
        const existing = await this.findOne({});
        if (existing) {
            return (await this.updateById(existing._id, {
                defaultTeam: teamId,
                autoJoinNewMembers
            }))!;
        }
        return this.create({
            defaultTeam: teamId,
            autoJoinNewMembers
        });
    }
}
