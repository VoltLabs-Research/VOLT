import {
    toPersistedEntity,
    type PersistedEntity,
    type PersistedEntityOutput
} from '@shared/domain/persisted/to-persisted-entity';

export type { PersistedEntity };

export type PersistedOutput<TProps> = PersistedEntityOutput<TProps>;

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

    return toPersistedEntity(entity);
};
