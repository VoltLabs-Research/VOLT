import type { User } from '@/modules/auth/api/entities/user';

export interface Whiteboard {
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: User | string | null;
    createdAt: Date;
    updatedAt: Date;
};
