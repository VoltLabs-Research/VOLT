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

export class BaseMapper<
    TDomain,
    TProps,
    TDocument extends object
> implements IMapper<TDomain, TProps, HydratedDocument<TDocument>> {

    constructor(
        private readonly entityClass: EntityConstructor<TDomain, TProps>,
        private readonly relationKeys: Array<Extract<keyof TProps, string>> = []
    ){}

    toDomain(doc: HydratedDocument<TDocument>): TDomain {
        const documentProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
        const { _id: _ignoredId, __v: _ignoredVersion, ...props } = documentProps;

        const _id = doc._id!.toString();

        this.relationKeys.forEach((key) => {
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

        return new this.entityClass(_id, props as TProps);
    }

    private getPersistenceSource(domainOrProps: TDomain | TProps | Partial<TProps>): Record<string, unknown> {
        if (hasPropsRecord<TProps>(domainOrProps)) {
            return domainOrProps.props as Record<string, unknown>;
        }

        if (isRecord(domainOrProps)) {
            return domainOrProps;
        }

        return {};
    }

    toPersistence(domainOrProps: TDomain | TProps | Partial<TProps>): Record<string, unknown> {
        const persistenceSource = this.getPersistenceSource(domainOrProps);
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
