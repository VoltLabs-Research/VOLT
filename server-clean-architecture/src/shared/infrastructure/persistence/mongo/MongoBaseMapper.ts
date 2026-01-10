import { HydratedDocument } from "mongoose";
import { IMapper } from "../IMapper";

export abstract class BaseMapper<TDomain, TProps, TDocument>
    implements IMapper<TDomain, TProps, TDocument>{
    
    constructor(
        private readonly entityClass: any,
        private readonly relationKeys: (keyof TProps)[] = []
    ){}

    toDomain(doc: HydratedDocument<TDocument>): TDomain{
        const rawProps = doc.toObject({ flattenMaps: true });
        const props: any = { ...rawProps };
        
        const id = doc._id!.toString();
        
        this.relationKeys.forEach((key) => {
            const value = (doc as any)[key];
            if(!value) return;

            if(Array.isArray(value)){
                props[key] = value.map((value) => value._id?.toString() || value.toString());
            }else{
                props[key] = value._id?.toString() || value.toString()
            }
        });

        delete props._id;
        delete props.__v;

        return new this.entityClass(id, props);
    }

    toPersistence(props: TProps): Partial<TDocument>{
        return props as any;
    }
}