/**
 * Neutral, cross-module repository-port contract for deployment settings.
 *
 * Extracted from `@modules/system/ports/IDeploymentSettingsRepository`
 * during the detachable-modules migration so consumers (team enrollment,
 * notification onboarding, …) inject against a contract rather than
 * `@modules/system`.
 *
 * The `DeploymentSettings` entity/props classes are NOT part of the neutral
 * contracts layer, so this port is GENERIC over them. It constrains the entity
 * to the minimal `DeploymentSettingsView` structural shape that cross-module
 * consumers actually read (`props.defaultTeam` / `props.autoJoinNewMembers`),
 * so a consumer can use the default parameterisation without importing the
 * concrete entity. The owner module re-exports a bound alias so existing
 * importers compile unchanged.
 */
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
