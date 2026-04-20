import { asClass, asFunction, type AwilixContainer } from 'awilix';

export type ServiceLifetime = 'singleton' | 'scoped' | 'transient';

interface ServiceMetadata {
    readonly registrationName: string;
    readonly lifetime: ServiceLifetime;
    readonly kind: 'class' | 'function';
    readonly target: unknown;
}

const registered: ServiceMetadata[] = [];

export const Service = (
    registrationName: string,
    options: { lifetime?: ServiceLifetime } = {}
): ClassDecorator => (target) => {
    registered.push({
        registrationName,
        lifetime: options.lifetime ?? 'singleton',
        kind: 'class',
        target
    });
};

export const Factory = <TFn extends (...args: any[]) => unknown>(
    registrationName: string,
    options: { lifetime?: ServiceLifetime } = {}
) => (target: TFn): TFn => {
    registered.push({
        registrationName,
        lifetime: options.lifetime ?? 'singleton',
        kind: 'function',
        target
    });
    return target;
};

export const applyDecoratedServices = (container: AwilixContainer): void => {
    const seen = new Set<string>();

    for (const { registrationName, lifetime, kind, target } of registered) {
        if (seen.has(registrationName)) {
            throw new Error(`Duplicate @Service registration: ${registrationName}`);
        }
        seen.add(registrationName);

        const resolver = kind === 'class'
            ? asClass(target as new (...args: any[]) => unknown)
            : asFunction(target as (...args: any[]) => unknown);

        container.register({ [registrationName]: resolver[lifetime]() });
    }
};
