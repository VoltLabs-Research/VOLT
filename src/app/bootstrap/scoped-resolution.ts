import { asValue, type AwilixContainer } from 'awilix';

type ScopedValues = Record<string, unknown>;

export const resolveScopedRegistration = <TResolved>(
    container: AwilixContainer,
    registrationName: string,
    values: ScopedValues
): TResolved => {
    const scope = container.createScope();
    const registrations: Record<string, ReturnType<typeof asValue>> = {};

    for (const [name, value] of Object.entries(values)) {
        registrations[name] = asValue(value);
    }

    scope.register(registrations);

    return scope.resolve<TResolved>(registrationName);
};
