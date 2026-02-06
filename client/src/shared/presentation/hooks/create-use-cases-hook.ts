import { useMemo } from 'react';
import { container } from 'tsyringe';

type TokenMap = Record<string, symbol>;

type UseCaseInstances<T extends TokenMap> = {
    [K in keyof T]: T[K] extends symbol ? unknown : never;
};

/**
 * Factory to create a use cases hook from a tokens object.
 * Resolves all use cases from the DI container and memoizes them.
 */
export const createUseCasesHook = <T extends TokenMap>(tokens: T) => {
    return (): UseCaseInstances<T> => {
        return useMemo(() => {
            const instances = {} as UseCaseInstances<T>;
            for (const key in tokens) {
                (instances as Record<string, unknown>)[key] = container.resolve(tokens[key]);
            }
            return instances;
        }, []);
    };
};
