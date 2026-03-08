export interface PersistedEntity<TProps> {
    _id: string;
    props: TProps;
}

export type PersistedOutput<TProps> = TProps & {
    _id: string;
};

interface EntityWithProps<TProps> {
    props: TProps;
}

const asPersistedEntity = <TProps>(entity: EntityWithProps<TProps>): PersistedEntity<TProps> => {
    return entity as PersistedEntity<TProps>;
};

export const toPersistedOutput = <TProps>(entity: EntityWithProps<TProps>): PersistedOutput<TProps> => {
    const persistedEntity = asPersistedEntity(entity);

    return {
        _id: persistedEntity._id,
        ...persistedEntity.props
    };
};
