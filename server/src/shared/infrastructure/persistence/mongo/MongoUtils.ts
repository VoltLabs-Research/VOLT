import { Types, Document, SchemaDefinition } from 'mongoose';

export type Persistable<T, Relations extends keyof T = never> = Omit<T, 'id' | Relations> & {
    _id: Types.ObjectId;
} & {
    [K in Relations]: T[K] extends any[] ? Types.ObjectId[] : Types.ObjectId;
};

type MongooseSchema<T> = SchemaDefinition<Omit<T, keyof Document>>;