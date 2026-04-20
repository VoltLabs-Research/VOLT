export type DecoratedGroupClass = new (...args: any[]) => any;

export interface DecoratedGroupMetadata<TMethod> {
    readonly namespace: string;
    readonly methods: readonly TMethod[];
}

export interface DecoratedGroupRegistry<TMethod> {
    registerGroup(target: DecoratedGroupClass, namespace: string): void;
    registerMethod(target: DecoratedGroupClass, method: TMethod): void;
    getMetadata(value: unknown): DecoratedGroupMetadata<TMethod> | null;
    getRegisteredGroups(): readonly DecoratedGroupClass[];
}

export const createDecoratedGroupRegistry = <TMethod>(): DecoratedGroupRegistry<TMethod> => {
    const registeredGroups = new Set<DecoratedGroupClass>();
    const namespaces = new WeakMap<DecoratedGroupClass, string>();
    const methods = new WeakMap<DecoratedGroupClass, TMethod[]>();

    const getMethods = (target: DecoratedGroupClass): TMethod[] => {
        const existingMethods = methods.get(target);
        if (existingMethods) {
            return existingMethods;
        }

        const nextMethods: TMethod[] = [];
        methods.set(target, nextMethods);
        return nextMethods;
    };

    return {
        registerGroup(target, namespace) {
            namespaces.set(target, namespace);
            registeredGroups.add(target);
        },
        registerMethod(target, method) {
            getMethods(target).push(method);
        },
        getMetadata(value) {
            if (typeof value !== 'function') {
                return null;
            }

            const target = value as DecoratedGroupClass;
            const namespace = namespaces.get(target);
            const groupMethods = methods.get(target);

            if (!namespace || !groupMethods?.length) {
                return null;
            }

            return {
                namespace,
                methods: [...groupMethods]
            };
        },
        getRegisteredGroups() {
            return [...registeredGroups];
        }
    };
};

export interface MaterializeDecoratedGroupsConfig<TMethod> {
    readonly kind: string;
    readonly groups: readonly DecoratedGroupClass[];
    readonly getMetadata: (group: DecoratedGroupClass) => DecoratedGroupMetadata<TMethod> | null;
}

export interface MaterializedDecoratedGroup<TMethod> {
    readonly registrationName: string;
    readonly Group: DecoratedGroupClass;
    readonly namespace: string;
    readonly methods: readonly TMethod[];
}

export const materializeRegisteredDecoratedGroups = <TMethod>(
    config: MaterializeDecoratedGroupsConfig<TMethod>
): MaterializedDecoratedGroup<TMethod>[] => {
    const registrationNames = new Set<string>();
    const materializedGroups: MaterializedDecoratedGroup<TMethod>[] = [];

    for (const Group of config.groups) {
        const metadata = config.getMetadata(Group);
        if (!metadata) {
            continue;
        }

        const registrationName = `${config.kind}:${metadata.namespace}.${Group.name}`;
        if (registrationNames.has(registrationName)) {
            throw new Error(`Duplicate decorated group registration: ${registrationName}`);
        }

        registrationNames.add(registrationName);
        materializedGroups.push({
            registrationName,
            Group,
            namespace: metadata.namespace,
            methods: metadata.methods
        });
    }

    return materializedGroups;
};
