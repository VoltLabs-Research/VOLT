import eventBus from '@shared/infrastructure/events/RedisEventBus';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import {
    findFilesByDocument,
    requireDocument,
    requireFile
} from '@modules/latex/services/latex-queries';
import type { DocumentScoped } from '@modules/latex/services/latex-queries';
import type {
    CreateLatexFileInput,
    UpdateLatexFileInput
} from '@volt/contracts/modules/latex/http';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';

const toFileView = (file: LatexFileEntity): LatexFile => ({
    _id: file.id,
    documentId: file.document,
    name: file.name,
    path: file.path,
    content: file.content,
    isEntrypoint: file.isEntrypoint,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString()
});

const clearEntrypointForDocument = async (documentId: string): Promise<void> => {
    await LatexFileEntity.update({
        document: documentId,
        isEntrypoint: true
    }, { isEntrypoint: false });
};

const promoteToEntrypoint = async (file: LatexFileEntity): Promise<LatexFileEntity> => {
    await clearEntrypointForDocument(file.document);
    return Object.assign(file, {
        isEntrypoint: true,
        updatedAt: new Date()
    }).save();
};

export default class LatexFileService{
    async listFiles(input: DocumentScoped): Promise<LatexFile[]>{
        await requireDocument(input.teamId, input.documentId);
        const files = await findFilesByDocument(input.documentId);
        return files.map((file) => toFileView(file));
    }

    async createFile(input: CreateLatexFileInput & DocumentScoped & { userId: string }): Promise<LatexFile>{
        await requireDocument(input.teamId, input.documentId);

        if(input.isEntrypoint){
            await clearEntrypointForDocument(input.documentId);
        }

        const file = await LatexFileEntity.create({
            document: input.documentId,
            team: input.teamId,
            name: input.name.trim(),
            path: input.path ?? '',
            content: input.content ?? '',
            isEntrypoint: input.isEntrypoint ?? false,
            createdBy: input.userId
        }).save();

        return toFileView(file);
    }

    async updateFile(input: UpdateLatexFileInput & DocumentScoped & { fileId: string; source?: 'ai' }): Promise<LatexFile>{
        await requireDocument(input.teamId, input.documentId);
        const existing = await requireFile(input.documentId, input.fileId);

        const patch: Partial<LatexFileEntity> = { updatedAt: new Date() };
        if(input.name !== undefined) patch.name = input.name.trim();
        if(input.path !== undefined) patch.path = input.path;
        if(input.content !== undefined) patch.content = input.content;

        const updated = await Object.assign(existing, patch).save();

        if(input.source === 'ai' && input.content !== undefined){
            await eventBus.emit('latex-file.content.updated', {
                documentId: input.documentId,
                teamId: input.teamId,
                fileId: input.fileId,
                content: input.content
            });
        }

        return toFileView(updated);
    }

    async deleteFile(input: DocumentScoped & { fileId: string }): Promise<void>{
        await requireDocument(input.teamId, input.documentId);
        const file = await requireFile(input.documentId, input.fileId);

        if(file.isEntrypoint){
            const remainingFiles = (await findFilesByDocument(input.documentId))
                .filter((currentFile) => currentFile.id !== input.fileId);

            if(remainingFiles.length > 0){
                const nextEntrypoint = remainingFiles.find((currentFile) =>
                    currentFile.name.toLowerCase().endsWith('.tex')
                ) ?? remainingFiles[0];

                await promoteToEntrypoint(nextEntrypoint);
            }
        }

        await LatexFileEntity.delete({ id: input.fileId });
    }

    async setFileEntrypoint(input: DocumentScoped & { fileId: string }): Promise<LatexFile>{
        await requireDocument(input.teamId, input.documentId);
        const file = await requireFile(input.documentId, input.fileId);

        return toFileView(await promoteToEntrypoint(file));
    }
}
