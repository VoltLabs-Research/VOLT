import { container } from 'tsyringe';
import type { InjectionToken, Lifecycle } from 'tsyringe';

type Constructable<T = unknown> = new (...args: any[]) => T;
type SingletonRegistration = Constructable | readonly [InjectionToken<unknown>, Constructable<unknown>];
type ClassBindingRegistration = Constructable
    | readonly [InjectionToken<unknown>, Constructable<unknown>]
    | readonly [InjectionToken<unknown>, Constructable<unknown>, Lifecycle];
type AliasRegistration = readonly [InjectionToken<unknown>, InjectionToken<unknown>];
type ClassBindingSource = readonly Constructable<unknown>[] | Record<string, Constructable<unknown>>;

const isTokenRegistration = (registration: SingletonRegistration): registration is readonly [InjectionToken<unknown>, Constructable<unknown>] => {
    return Array.isArray(registration);
};

const isTokenClassBinding = (
    registration: ClassBindingRegistration
): registration is readonly [InjectionToken<unknown>, Constructable<unknown>] | readonly [InjectionToken<unknown>, Constructable<unknown>, Lifecycle] => {
    return Array.isArray(registration);
};

const resolveBindingClasses = (bindings: ClassBindingSource): readonly Constructable<unknown>[] => {
    if (Array.isArray(bindings)) {
        return bindings;
    }

    return Object.values(bindings);
};

interface ModuleDependencyRegistration {
    singletons?: readonly SingletonRegistration[];
    bindings?: readonly ClassBindingRegistration[];
    aliases?: readonly AliasRegistration[];
};

export const createClassBindings = (
    token: InjectionToken<unknown>,
    bindings: ClassBindingSource,
    lifecycle?: Lifecycle
): ClassBindingRegistration[] => {
    return resolveBindingClasses(bindings).map((useClass): ClassBindingRegistration => {
        if (lifecycle === undefined) {
            const registration: ClassBindingRegistration = [token, useClass];
            return registration;
        }

        const registration: ClassBindingRegistration = [token, useClass, lifecycle];
        return registration;
    });
};

export const registerModuleDependencies = ({
    singletons = [],
    bindings = [],
    aliases = []
}: ModuleDependencyRegistration): void => {
    for (const registration of singletons) {
        if (isTokenRegistration(registration)) {
            container.registerSingleton(registration[0], registration[1]);
            continue;
        }

        container.registerSingleton(registration);
    }

    for (const registration of bindings) {
        if (isTokenClassBinding(registration)) {
            const [token, useClass, lifecycle] = registration;

            if (lifecycle === undefined) {
                container.register(token, { useClass });
                continue;
            }

            container.register(token, { useClass }, { lifecycle });
            continue;
        }

        container.register(registration, { useClass: registration });
    }

    for (const [token, target] of aliases) {
        container.register(token, { useToken: target });
    }
};
