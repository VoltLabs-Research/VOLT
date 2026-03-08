import type { HydratedDocument } from 'mongoose';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

interface EntityConstructor<TDomain, TProps> {
    new (_id: string, props: TProps): TDomain;
}

interface IdentifierValue {
    toString(): string;
}

const isIdentifierValue = (value: unknown): value is IdentifierValue => {
    return typeof value === 'object' && value !== null && 'toString' in value;
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

export abstract class MongoBaseMapper<TDomain, TProps, TDocument>
    implements IMapper<TDomain, TProps, TDocument> {

    constructor(
        private readonly entityClass: EntityConstructor<TDomain, TProps>,
        private readonly relationKeys: (keyof TProps)[] = []
    ){}

    toDomain(doc: HydratedDocument<TDocument>): TDomain {
        const rawProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
        const props = { ...rawProps };

        const _id = doc._id!.toString();

        this.relationKeys.forEach((key) => {
            const value = (doc as unknown as Record<string, unknown>)[key as string];
            if (!value) return;

            if (doc.populated(key as string)) {
                return;
            }

            if (Array.isArray(value)) {
                props[key as string] = value.map((relationValue) => toIdentifier(relationValue));
            } else {
                props[key as string] = toIdentifier(value);
            }
        });

        delete props._id;
        delete props.__v;

        return new this.entityClass(_id, props as unknown as TProps);
    }

    private getPersistenceSource(domainOrProps: TDomain | TProps): TProps {
        if (isRecord(domainOrProps) && isRecord(domainOrProps.props)) {
            return domainOrProps.props as TProps;
        }

        return domainOrProps as TProps;
    }

    toPersistence(domainOrProps: TDomain | TProps): Partial<TDocument> {
        const persistenceSource = this.getPersistenceSource(domainOrProps);
        const persistenceData: Partial<TDocument> = {};

        Object.keys(persistenceSource as object).forEach((propertyName) => {
            Reflect.set(
                persistenceData,
                propertyName,
                (persistenceSource as Record<string, unknown>)[propertyName]
            );
        });

        return persistenceData;
    }
}

export { MongoBaseMapper as BaseMapper };
