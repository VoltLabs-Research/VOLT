
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface DeploymentSettingsView {
    props: {
        defaultTeam: string | null;
        autoJoinNewMembers: boolean;
    };
}

export interface IDeploymentSettingsRepository<
    TSettings extends DeploymentSettingsView = DeploymentSettingsView,
    TSettingsProps = unknown
> extends IBaseRepository<TSettings, TSettingsProps> {
    getSettings(): Promise<TSettings>;
    setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<TSettings>;
}
