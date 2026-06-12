export interface DeploymentSettingsProps {
    defaultTeam: string | null;
    autoJoinNewMembers: boolean;
    // null = all modules enabled by default (existing deployments unaffected).
    enabledModules: string[] | null;
    createdAt: Date;
    updatedAt: Date;
}

export default class DeploymentSettings {
    constructor(
        public readonly _id: string,
        public props: DeploymentSettingsProps
    ){}
}
