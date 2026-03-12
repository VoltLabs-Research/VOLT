import type { User } from '@/modules/auth/api/entities/user';

export interface LatexDocument {
    _id: string;
    title: string;
    content: string;
    folder: string | null;
    createdBy?: User | string;
    lastEditedBy?: User | string | null;
    createdAt: Date;
    updatedAt: Date;
};
