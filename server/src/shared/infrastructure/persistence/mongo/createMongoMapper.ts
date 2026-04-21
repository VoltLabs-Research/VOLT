import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';
import type { HydratedDocument } from 'mongoose';

interface EntityConstructor<TDomain, TProps> {
    new (_id: string, props: TProps): TDomain;
};

interface IdentifierValue {
    toString(): string;
};

interface DomainWithProps<TProps> {
    props: TProps;
};

const isIdentifierValue = (value: unknown): value is IdentifierValue => {
    return typeof value === 'object' && value !== null && 'toString' in value;
};

const hasPropsRecord = <TProps>(
    value: TProps | Partial<TProps> | DomainWithProps<TProps> | unknown
): value is DomainWithProps<TProps> => {
    return isRecord(value) && isRecord(value.props);
};

const toIdentifier = (value: unknown): string => {
    if (isRecord(value) && isIdentifierValue(value._id)) {
        return value._id.toString();
    }

    if (isIdentifierValue(value)) {
        return value.toString();
    }

    return String(value);
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
    const getPersistenceSource = (domainOrProps: TDomain | TProps | Partial<TProps>): Record<string, unknown> => {
        if (hasPropsRecord<TProps>(domainOrProps)) {
            return domainOrProps.props as Record<string, unknown>;
        }

        if (isRecord(domainOrProps)) {
            return domainOrProps;
        }

        return {};
    };

    return {
        toDomain(doc: HydratedDocument<TDocument>): TDomain {
            const documentProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
            const { _id: _ignoredId, __v: _ignoredVersion, ...props } = documentProps;

            const _id = doc._id!.toString();

            relationKeys.forEach((key) => {
                const value = Reflect.get(doc, key);
                if (!value) return;

                if (doc.populated(key)) {
                    return;
                }

                if (Array.isArray(value)) {
                    Reflect.set(props, key, value.map((relationValue: unknown) => toIdentifier(relationValue)));
                } else {
                    Reflect.set(props, key, toIdentifier(value));
                }
            });

            return factory(_id, props as TProps);
        },

        toPersistence(domainOrProps: TDomain | TProps | Partial<TProps>): Record<string, unknown> {
            const persistenceSource = getPersistenceSource(domainOrProps);
            const persistenceData: Record<string, unknown> = {};

            Object.keys(persistenceSource).forEach((propertyName) => {
                Reflect.set(
                    persistenceData,
                    propertyName,
                    persistenceSource[propertyName]
                );
            });

            return persistenceData;
        }
    };
};
