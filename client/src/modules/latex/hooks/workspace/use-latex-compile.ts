import { useCompileLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import { ErrorSurface, isApiError, reportError } from '@/shared/errors/core';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLatexCompileInput{
    documentId: string;
    hasCompilableTexFile: boolean;
}

/** Pulls the most useful message out of a failed compile response body. */
const readBlobErrorMessage = async (data: Blob): Promise<string | null> => {
    try{
        const text = await data.text();

        try{
            const parsed: unknown = JSON.parse(text);
            if(typeof parsed === 'object' && parsed !== null){
                for(const key of ['logs', 'message', 'error'] as const){
                    const value = (parsed as Record<string, unknown>)[key];
                    if(typeof value === 'string' && value.trim()) return value;
                }
            }
        }catch{
            // not JSON: fall through to the raw text
        }

        return text.trim() || null;
    }catch{
        return null;
    }
};

const readResponseBlob = (error: unknown): Blob | null => {
    const axiosError: unknown = isApiError(error) ? error.originalError : error;
    if(typeof axiosError !== 'object' || axiosError === null || !('response' in axiosError)) return null;

    const response = axiosError.response;
    if(typeof response !== 'object' || response === null || !('data' in response)) return null;

    return response.data instanceof Blob ? response.data : null;
};

/**
 * Owns the compiled PDF for one document: runs the compile, keeps the object
 * URL alive for the preview, and revokes it before replacing it.
 *
 * Compiles are versioned with a request id so a slow run that finishes after a
 * newer one cannot overwrite the fresher result.
 */
const useLatexCompile = ({ documentId, hasCompilableTexFile }: UseLatexCompileInput) => {
    const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
    const [compiledPdfBlob, setCompiledPdfBlob] = useState<Blob | null>(null);
    const [compileError, setCompileError] = useState<string | null>(null);

    const compiledPdfUrlRef = useRef<string | null>(null);
    const compileRequestIdRef = useRef(0);

    const { mutateAsync: compileDocument, isPending: isCompiling } = useCompileLatexDocumentMutation();

    useEffect(() => {
        compileRequestIdRef.current = 0;
    }, [documentId]);

    const revokePdfUrl = (): void => {
        if(!compiledPdfUrlRef.current) return;
        URL.revokeObjectURL(compiledPdfUrlRef.current);
        compiledPdfUrlRef.current = null;
    };

    const clearPdf = (): void => {
        revokePdfUrl();
        setCompiledPdfBlob(null);
        setCompiledPdfUrl(null);
    };

    const compileSilently = useCallback(async (): Promise<Blob | null> => {
        const requestId = ++compileRequestIdRef.current;
        const isStale = () => requestId !== compileRequestIdRef.current;

        if(!documentId) return null;

        if(!hasCompilableTexFile){
            if(isStale()) return null;
            clearPdf();
            setCompileError('Add a .tex file to generate the PDF preview.');
            return null;
        }

        setCompileError(null);

        try{
            const blob = await compileDocument({ documentId });
            if(isStale()) return null;

            revokePdfUrl();
            const pdfUrl = URL.createObjectURL(blob);
            compiledPdfUrlRef.current = pdfUrl;
            setCompiledPdfBlob(blob);
            setCompiledPdfUrl(pdfUrl);
            return blob;
        }catch(error){
            if(isStale()) return null;
            clearPdf();

            const fallback = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Compilation failed'
            }).title;

            const responseBlob = readResponseBlob(error);
            const detail = responseBlob ? await readBlobErrorMessage(responseBlob) : null;

            setCompileError(detail ?? fallback);
            return null;
        }
    }, [compileDocument, documentId, hasCompilableTexFile]);

    return {
        compileSilently,
        compiledPdfUrl,
        compiledPdfBlob,
        compileError,
        isCompiling,
        revokePdfUrl
    };
};

export default useLatexCompile;
