export interface BaseEntity{
    _id: string;
    createdAt: string;
    updatedAt: string;
}

export type Ref<T> = string | T;
