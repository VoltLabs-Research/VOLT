import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

interface EntityConstructor<TDomain, TProps> {
    new (_id: string, props: TProps): TDomain;
};

export const createMongoMapper = <
    TDomain,
    TProps,
    TDocument extends object
>(
    entityClass: EntityConstructor<TDomain, TProps>,
    relationKeys: Array<Extract<keyof TProps, string>> = []
) => {
    return new BaseMapper<TDomain, TProps, TDocument>(entityClass, relationKeys);
};
