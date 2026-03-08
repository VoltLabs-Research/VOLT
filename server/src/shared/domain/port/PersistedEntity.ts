export interface PersistedEntity<TProps> {
    _id: string;
    props: TProps;
};

export type PersistedOutput<TProps> = TProps & {
    _id: string;
};

interface EntityWithProps<TProps> {
    props: TProps;
};

const hasStringId = (entity: EntityWithProps<unknown>): entity is PersistedEntity<unknown> => {
    return '_id' in entity && typeof entity._id === 'string';
};

export const toPersistedOutput = <TProps>(entity: EntityWithProps<TProps>): PersistedOutput<TProps> => {
    if (!hasStringId(entity)) {
        throw new Error('Persisted entity is missing a string _id');
    }

    return {
        _id: entity._id,
        ...entity.props
    };
};
