export interface DeploymentSettingsProps {
    defaultTeam: string | null;
    autoJoinNewMembers: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export default class DeploymentSettings {
    constructor(
        public readonly _id: string,
        public props: DeploymentSettingsProps
    ){}
}
