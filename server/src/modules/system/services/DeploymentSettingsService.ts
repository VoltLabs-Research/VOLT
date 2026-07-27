import DeploymentSettingsModel, {
    DeploymentSettingsDocument,
    DeploymentSettingsProps
} from '@modules/system/models/DeploymentSettingsModel';

export interface DeploymentSettings {
    _id: string;
    props: DeploymentSettingsProps;
}

const toDomain = (doc: DeploymentSettingsDocument): DeploymentSettings => ({
    _id: String(doc._id),
    props: {
        defaultTeam: doc.defaultTeam ? String(doc.defaultTeam) : null,
        autoJoinNewMembers: doc.autoJoinNewMembers,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    }
});

export default class DeploymentSettingsService {
    async getSettings(): Promise<DeploymentSettings> {
        const doc = await DeploymentSettingsModel.findOne({});
        if (!doc) {
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
        return toDomain(doc);
    }

    async setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings> {
        const existing = await DeploymentSettingsModel.findOne({});
        if (existing) {
            existing.defaultTeam = teamId as unknown as DeploymentSettingsDocument['defaultTeam'];
            existing.autoJoinNewMembers = autoJoinNewMembers;
            await existing.save();
            return toDomain(existing);
        }

        const created = await DeploymentSettingsModel.create({
            defaultTeam: teamId,
            autoJoinNewMembers
        });
        return toDomain(created);
    }
}
