import DeploymentSettingsEntity from '@modules/system/models/DeploymentSettings';
import type { DeploymentSettingsProps } from '@modules/system/contracts/deployment-settings';

const SINGLETON_KEY = 'singleton';

interface DeploymentSettings {
    _id: string;
    props: DeploymentSettingsProps;
}

const toDomain = (settings: DeploymentSettingsEntity): DeploymentSettings => ({
    _id: settings.id,
    props: {
        defaultTeam: settings.defaultTeam,
        autoJoinNewMembers: settings.autoJoinNewMembers,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
    }
});

export default class DeploymentSettingsService {
    async getSettings(): Promise<DeploymentSettings> {
        const settings = await DeploymentSettingsEntity.findOneBy({ key: SINGLETON_KEY });
        if (!settings) {
            return {
                _id: '',
                props: {
                    defaultTeam: null,
                    autoJoinNewMembers: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            };
        }

        return toDomain(settings);
    }

    async setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings> {
        const existing = await DeploymentSettingsEntity.findOneBy({ key: SINGLETON_KEY });
        if (existing) {
            return toDomain(await Object.assign(existing, {
                defaultTeam: teamId,
                autoJoinNewMembers
            }).save());
        }

        const created = await DeploymentSettingsEntity.create({
            key: SINGLETON_KEY,
            defaultTeam: teamId,
            autoJoinNewMembers
        }).save();

        return toDomain(created);
    }
}
