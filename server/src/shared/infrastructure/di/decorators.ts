import { container, injectable, Lifecycle } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

type Ctor<T = unknown> = new (...args: any[]) => T;

/**
 * Declarative replacement for the old `manifest.ts` files. A class decorated
 * with `@Singleton(TOKEN)` auto-registers itself in tsyringe as a singleton
 * bound to that token at class-evaluation time. With no token it registers
 * under the class constructor. Applies `@injectable()` transparently so most
 * infrastructure classes only need this one decorator.
 */
export const Singleton = (token?: InjectionToken<unknown>): ClassDecorator => {
    return (target) => {
        injectable()(target as unknown as Ctor);
        if (token) {
            container.registerSingleton(token, target as unknown as Ctor);
        } else {
            container.registerSingleton(target as unknown as Ctor);
        }
    };
};

/**
 * Transient binding (a new instance per resolve). Mirrors the `bindings` slot
 * of the old ModuleManifest when no lifecycle is specified.
 */
export const Transient = (token?: InjectionToken<unknown>): ClassDecorator => {
    return (target) => {
        injectable()(target as unknown as Ctor);
        if (token) {
            container.register(token, { useClass: target as unknown as Ctor });
        } else {
            container.register(target as unknown as Ctor, { useClass: target as unknown as Ctor });
        }
    };
};

/**
 * Binds a class to `token` using an explicit lifecycle. Useful for collection
 * members that need to be singletons registered under a shared token.
 */
export const Bound = (
    token: InjectionToken<unknown>,
    lifecycle: Lifecycle
): ClassDecorator => {
    return (target) => {
        injectable()(target as unknown as Ctor);
        container.register(
            token,
            { useClass: target as unknown as Ctor },
            { lifecycle }
        );
    };
};

/**
 * Registers the decorated class under an additional token that resolves to the
 * same singleton registered via `@Singleton`. Mirrors the `aliases` slot of
 * the old ModuleManifest (e.g., a concrete socket module also answering to
 * `SOCKET_TOKENS.SocketModule`).
 *
 * Must be declared BELOW `@Singleton(...)` in the source order so the primary
 * registration exists when the alias is wired.
 */
export const AliasOf = (targetToken: InjectionToken<unknown>): ClassDecorator => {
    return (_target) => {
        container.register(targetToken, { useToken: _target as unknown as InjectionToken });
    };
};

/**
 * Registers the decorated class as a singleton member of a "collection" token
 * resolved via `container.resolveAll(token)`. Replaces the
 * `createClassBindings(TOKEN, [...])` helper used by AI tools and socket
 * modules.
 */
export const CollectionMember = (token: InjectionToken<unknown>): ClassDecorator => {
    return (target) => {
        injectable()(target as unknown as Ctor);
        container.register(
            token,
            { useClass: target as unknown as Ctor },
            { lifecycle: Lifecycle.Singleton }
        );
    };
};
