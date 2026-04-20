import type { DecoratedGroupClass } from '@/core/decorators/create-decorated-group-registry';
import { createNamespacedMethodDecorators } from '@/core/decorators/create-namespaced-method-decorators';

export interface CommandOptions {
    readonly raw?: boolean;
    readonly status?: number;
}

export interface CommandMethodMetadata {
    readonly name: string;
    readonly options: CommandOptions;
    readonly propertyKey: string;
}

export interface CommandGroupMetadata {
    readonly namespace: string;
    readonly commands: readonly CommandMethodMetadata[];
}

const decorators = createNamespacedMethodDecorators<CommandMethodMetadata, [name: string, options?: CommandOptions]>({
    decoratorLabel: '@Command',
    buildMethodMetadata: (propertyKey, name, options = {}) => ({ name, options, propertyKey })
});

export const CommandGroup = decorators.Group;
export const Command = decorators.Method;

export const getCommandGroupMetadata = (value: unknown): CommandGroupMetadata | null => {
    const metadata = decorators.getMetadata(value);
    if (!metadata) {
        return null;
    }

    return {
        namespace: metadata.namespace,
        commands: metadata.methods
    };
};

export const getRegisteredCommandGroups = (): readonly DecoratedGroupClass[] => decorators.getRegisteredGroups();
