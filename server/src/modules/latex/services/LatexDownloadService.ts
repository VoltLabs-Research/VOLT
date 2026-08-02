import tempFileService from '@shared/infrastructure/services/TempFileService';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/services/LatexCompiler';
import {
    requireLatexStorageClusterId,
    sanitizeAssetPath
} from '@modules/latex/services/LatexAssetStorage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import { createDownloadStreamResponse, sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import {
    findAssetsByDocument,
    findEntrypoint,
    findFilesByDocument,
    requireDocument
} from '@modules/latex/services/latex-queries';
import type { DocumentScoped } from '@modules/latex/services/latex-queries';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';

const PREPARATION_FAILURES = {
    'no-document': () => ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found'),
    'no-files': () => new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'This document has no LaTeX files. Create main.tex before compiling.', 422),
    'no-entrypoint': () => new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'No .tex file was found in this document. Add or select a .tex file to compile.', 422),
    'no-compiler': () => new ApplicationError(ErrorCodes.LATEX_COMPILER_NOT_FOUND, 'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.', 503)
};

const readCompiledPdf = async (workDir: string, entrypointFilename: string, pdfName: string): Promise<Buffer | null> => {
    const entrypointDir = path.dirname(entrypointFilename);
    const candidates = [path.join(workDir, pdfName)];
    if(entrypointDir !== '.'){
        candidates.push(path.join(workDir, entrypointDir, pdfName));
    }

    for(const candidate of candidates){
        try{
            return await fs.readFile(candidate);
        }catch(error: unknown){
            if((error as NodeJS.ErrnoException).code !== 'ENOENT'){
                throw error;
            }
        }
    }

    return null;
};

export default class LatexDownloadService{
    #archiveService = new ClusterObjectArchiveService();

    async exportDocumentTex(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const document = await requireDocument(input.teamId, input.documentId);

        const entrypoint = findEntrypoint(await findFilesByDocument(input.documentId));

        if(!entrypoint){
            throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'No .tex file was found in this document. Add or select a .tex file to export.', 422);
        }

        const safeName = sanitizeDownloadName(document.title, 'document');
        return createDownloadStreamResponse({
            stream: Readable.from([entrypoint.content]),
            contentType: 'application/x-tex; charset=utf-8',
            filename: `${safeName}.tex`,
            cacheControl: 'no-cache'
        });
    }

    async exportDocumentZip(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const document = await requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const [latexFiles, assets] = await Promise.all([
            findFilesByDocument(input.documentId),
            findAssetsByDocument(input.documentId)
        ]);

        const safeName = sanitizeDownloadName(document.title, 'document');

        if(latexFiles.length === 0){
            throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'This document has no LaTeX files. Create main.tex before exporting.', 422);
        }

        return this.#archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/latex/${input.documentId}/${v4()}.zip`,
            filename: `${safeName}.zip`,
            cacheControl: 'no-cache',
            entries: [
                ...latexFiles.map((file) => ({
                    type: 'inline' as const,
                    name: file.path ? `${file.path}${file.name}` : file.name,
                    content: file.content
                })),
                ...assets.map((asset) => ({
                    type: 'object' as const,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: asset.storageKey,
                    name: sanitizeAssetPath(asset.path, asset.originalName),
                    optional: true
                }))
            ]
        });
    }

    async compileDocument(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const workDir = tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(input.teamId, input.documentId)
        );

        return withDocumentCompileLock(input.teamId, input.documentId, async () => {
            const preparation = await prepareWorkDir({
                teamId: input.teamId,
                documentId: input.documentId,
                workDir
            });

            if(preparation.status !== 'ready'){
                throw PREPARATION_FAILURES[preparation.status]();
            }

            const result = await runCompiler(preparation.compiler, workDir);
            if(!result.success){
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, result.log || 'LaTeX compilation failed with no output.', 422);
            }

            const pdfName = `${path.parse(preparation.entrypointFilename).name}.pdf`;
            const pdfBuffer = await readCompiledPdf(workDir, preparation.entrypointFilename, pdfName);

            if(!pdfBuffer){
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    result.log
                        ? `${result.log}\n\nCompilation did not produce the expected PDF output (${pdfName}).`
                        : `Compilation did not produce the expected PDF output (${pdfName}).`,
                    422
                );
            }

            return createDownloadStreamResponse({
                stream: Readable.from(pdfBuffer),
                contentType: 'application/pdf',
                filename: path.basename(pdfName),
                disposition: 'inline',
                contentLength: pdfBuffer.byteLength,
                cacheControl: 'no-cache'
            });
        });
    }
}
