import DeploymentSettingsEntity from '@modules/system/models/DeploymentSettings';

const SINGLETON_KEY = 'singleton';

interface DeploymentSettings {
    _id: string;
    props: {
        defaultTeam: string | null;
        autoJoinNewMembers: boolean;
    };
}

const toDomain = (settings: DeploymentSettingsEntity | null): DeploymentSettings => ({
    _id: settings?.id ?? '',
    props: {
        defaultTeam: settings?.defaultTeam ?? null,
        autoJoinNewMembers: settings?.autoJoinNewMembers ?? false
    }
});

export default class DeploymentSettingsService {
    async getSettings(): Promise<DeploymentSettings> {
        return toDomain(await DeploymentSettingsEntity.findOneBy({ key: SINGLETON_KEY }));
    }

    async setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings> {
        const existing = await DeploymentSettingsEntity.findOneBy({ key: SINGLETON_KEY })
            ?? DeploymentSettingsEntity.create({ key: SINGLETON_KEY });

        return toDomain(await Object.assign(existing, {
            defaultTeam: teamId,
            autoJoinNewMembers
        }).save());
    }
}
