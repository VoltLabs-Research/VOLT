import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';
import type { LatexFileProps } from '@modules/latex/domain/entities/LatexFile';

export interface ILatexFileRepository extends IBaseRepository<LatexFile, LatexFileProps> {
    findAllByDocument(documentId: string): Promise<LatexFile[]>;
    findByDocumentAndFileId(documentId: string, fileId: string): Promise<LatexFile | null>;
    clearEntrypointForDocument(documentId: string): Promise<void>;
}
