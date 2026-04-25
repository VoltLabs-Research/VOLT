import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';
import type { HydratedDocument } from 'mongoose';

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

type EntityFactory<TDomain, TProps> = (_id: string, props: TProps) => TDomain;

export const createMongoMapperFromFactory = <
    TDomain,
    TProps,
    TDocument extends object
>(
    factory: EntityFactory<TDomain, TProps>,
    relationKeys: Array<Extract<keyof TProps, string>> = []
): IMapper<TDomain, TProps, HydratedDocument<TDocument>> => {
    return new BaseMapper<TDomain, TProps, TDocument>(factory, relationKeys, true);
};
