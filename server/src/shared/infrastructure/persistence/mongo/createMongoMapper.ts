import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

interface EntityConstructor<TDomain, TProps> {
    new (_id: string, props: TProps): TDomain;
}

export const createMongoMapper = <TDomain, TProps, TDocument>(
    entityClass: EntityConstructor<TDomain, TProps>,
    relationKeys: (keyof TProps)[] = []
) => {
    return new (BaseMapper as unknown as {
        new (entity: EntityConstructor<TDomain, TProps>, keys: (keyof TProps)[]): BaseMapper<TDomain, TProps, TDocument>;
    })(entityClass, relationKeys);
};
