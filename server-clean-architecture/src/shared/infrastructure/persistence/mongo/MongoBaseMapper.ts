import { HydratedDocument } from 'mongoose';
import { IMapper } from '@shared/infrastructure/persistence/IMapper';

export abstract class BaseMapper<TDomain, TProps, TDocument>
    implements IMapper<TDomain, TProps, TDocument> {

    constructor(
        private readonly entityClass: any,
        private readonly relationKeys: (keyof TProps)[] = []
    ){}

    toDomain(doc: HydratedDocument<TDocument>): TDomain {
        const rawProps = doc.toObject({ flattenMaps: true });
        const props: any = { ...rawProps };

        const id = doc._id!.toString();

        this.relationKeys.forEach((key) => {
            const value = (doc as any)[key];
            if (!value) return;

            // If the field is populated in Mongoose, don't force it to a string ID.
            if (doc.populated(key as string)) {
                return;
            }

            if (Array.isArray(value)) {
                props[key] = value.map((v) => v._id?.toString() || v.toString());
            } else {
                props[key] = value._id?.toString() || value.toString()
            }
        });

        delete props.__v;

        return new this.entityClass(id, props);
    }

    toPersistence(props: TProps): Partial<TDocument> {
        return props as any;
    }
}