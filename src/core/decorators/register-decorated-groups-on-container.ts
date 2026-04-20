import { asClass, type AwilixContainer } from 'awilix';
import {
    materializeRegisteredDecoratedGroups,
    type DecoratedGroupClass,
    type DecoratedGroupMetadata
} from '@/core/decorators/create-decorated-group-registry';

export interface RegisterDecoratedGroupsConfig<TMethod> {
    readonly kind: string;
    readonly container: AwilixContainer;
    readonly groups: readonly DecoratedGroupClass[];
    readonly getMetadata: (group: DecoratedGroupClass) => DecoratedGroupMetadata<TMethod> | null;
    readonly onMethod: (ctx: {
        namespace: string;
        method: TMethod;
        resolveInstance: () => Record<string, unknown>;
    }) => void;
}

/**
 * Walks every decorated group, registers it in the awilix container as a
 * singleton class, and invokes `onMethod` once per decorated method. Used by
 * both `CommandRegistry` and `EventDispatcher` to avoid duplicating the DI
 * wiring.
 */
export const registerDecoratedGroupsOnContainer = <TMethod>(
    config: RegisterDecoratedGroupsConfig<TMethod>
): void => {
    const materialized = materializeRegisteredDecoratedGroups<TMethod>({
        kind: config.kind,
        groups: config.groups,
        getMetadata: config.getMetadata
    });

    for (const { registrationName, Group, namespace, methods } of materialized) {
        config.container.register({
            [registrationName]: asClass(Group).singleton()
        });

        const resolveInstance = () =>
            config.container.resolve<Record<string, unknown>>(registrationName);

        for (const method of methods) {
            config.onMethod({ namespace, method, resolveInstance });
        }
    }
};
