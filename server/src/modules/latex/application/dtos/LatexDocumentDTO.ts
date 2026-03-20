import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';

export interface LatexDocumentDTO {
    _id: string;
    title: string;
    content?: string;
    folder: string | null;
    createdBy?: LatexDocumentProps['createdBy'];
    lastEditedBy?: LatexDocumentProps['lastEditedBy'];
    createdAt: Date;
    updatedAt: Date;
};
