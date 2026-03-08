import { Types } from 'mongoose';

export type Persistable<T, Relations extends keyof T = never> = Omit<T, '_id' | Relations> & {
    _id: Types.ObjectId;
} & {
    [K in Relations]: T[K] extends unknown[] ? Types.ObjectId[] : Types.ObjectId;
};
