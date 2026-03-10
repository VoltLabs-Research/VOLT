import { container } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

type Constructable<T = unknown> = new (...args: any[]) => T;
type SingletonRegistration = Constructable | readonly [InjectionToken<unknown>, Constructable<unknown>];
type AliasRegistration = readonly [InjectionToken<unknown>, InjectionToken<unknown>];

const isTokenRegistration = (registration: SingletonRegistration): registration is readonly [InjectionToken<unknown>, Constructable<unknown>] => {
    return Array.isArray(registration);
};

interface ModuleDependencyRegistration {
    singletons?: readonly SingletonRegistration[];
    aliases?: readonly AliasRegistration[];
}

export const registerModuleDependencies = ({
    singletons = [],
    aliases = []
}: ModuleDependencyRegistration): void => {
    for (const registration of singletons) {
        if (isTokenRegistration(registration)) {
            container.registerSingleton(registration[0], registration[1]);
            continue;
        }

        container.registerSingleton(registration);
    }

    for (const [token, target] of aliases) {
        container.register(token, { useToken: target });
    }
};
