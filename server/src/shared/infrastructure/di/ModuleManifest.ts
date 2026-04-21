import { container } from 'tsyringe';
import type { InjectionToken, Lifecycle } from 'tsyringe';

type Constructable<T = unknown> = new (...args: any[]) => T;

export type ManifestSingleton =
    | Constructable
    | readonly [InjectionToken<unknown>, Constructable<unknown>];

export type ManifestBinding =
    | Constructable
    | readonly [InjectionToken<unknown>, Constructable<unknown>]
    | readonly [InjectionToken<unknown>, Constructable<unknown>, Lifecycle];

export type ManifestAlias = readonly [InjectionToken<unknown>, InjectionToken<unknown>];

export type ManifestClassSource = readonly Constructable<unknown>[] | Record<string, Constructable<unknown>>;

export interface ModuleManifest {
    name: string;
    singletons?: readonly ManifestSingleton[];
    bindings?: readonly ManifestBinding[];
    aliases?: readonly ManifestAlias[];
}

const isTokenSingleton = (
    registration: ManifestSingleton
): registration is readonly [InjectionToken<unknown>, Constructable<unknown>] => {
    return Array.isArray(registration);
};

const isTokenBinding = (
    registration: ManifestBinding
): registration is readonly [InjectionToken<unknown>, Constructable<unknown>] | readonly [InjectionToken<unknown>, Constructable<unknown>, Lifecycle] => {
    return Array.isArray(registration);
};

const resolveClasses = (source: ManifestClassSource): readonly Constructable<unknown>[] => {
    if (Array.isArray(source)) {
        return source;
    }

    return Object.values(source);
};

export const createClassBindings = (
    token: InjectionToken<unknown>,
    source: ManifestClassSource,
    lifecycle?: Lifecycle
): ManifestBinding[] => {
    return resolveClasses(source).map((useClass): ManifestBinding => {
        if (lifecycle === undefined) {
            return [token, useClass];
        }

        return [token, useClass, lifecycle];
    });
};

export const applyModuleManifest = (manifest: ModuleManifest): void => {
    const { singletons = [], bindings = [], aliases = [] } = manifest;

    for (const registration of singletons) {
        if (isTokenSingleton(registration)) {
            container.registerSingleton(registration[0], registration[1]);
            continue;
        }

        container.registerSingleton(registration);
    }

    for (const registration of bindings) {
        if (isTokenBinding(registration)) {
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

export const applyModuleManifests = (manifests: readonly ModuleManifest[]): void => {
    for (const manifest of manifests) {
        applyModuleManifest(manifest);
    }
};
