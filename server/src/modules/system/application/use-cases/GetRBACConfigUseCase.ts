import { injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { RBACConfig } from '@modules/system/domain/value-objects/RBACConfig';
import { Resource } from '@core/constants/resources';
import { Action } from '@core/constants/permissions';

/**
 * Converts enum keys like SSH_CONNECTION to "SSH Connection"
 */
const toLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());

@injectable()
export class GetRBACConfigUseCase implements IUseCase<void, RBACConfig> {
    async execute(): Promise<Result<RBACConfig>> {
        const resources = Object.entries(Resource).map(([enumKey, value]) => ({
            key: value,
            label: toLabel(enumKey)
        }));

        const actions = Object.entries(Action).map(([enumKey, value]) => ({
            key: value,
            label: toLabel(enumKey)
        }));

        return Result.ok({ resources, actions });
    }
}
