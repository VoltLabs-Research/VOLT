import { Button, Loader, Row, Stack, Text } from '@voltstack/bravais';
import { AlertCircle, Download, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface LatexPdfViewerProps {
    pdfUrl: string | null;
    isLoading?: boolean;
    error?: string | null;
    onDownload?: () => void;
    downloadLabel?: string;
}

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;

const LatexPdfViewer = ({
    pdfUrl,
    isLoading = false,
    error = null,
    onDownload,
    downloadLabel = 'Export PDF'
}: LatexPdfViewerProps) => {
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1);
    /**
     * URL of the PDF currently painted on screen. It only advances to a newer
     * compile result once that result has finished rendering off-screen, so live
     * recompiles swap in seamlessly — no loading flash, no zoom/scroll reset.
     */
    const [committedUrl, setCommittedUrl] = useState<string | null>(null);
    /** Incoming buffer URL that has finished rendering and is ready to be shown. */
    const [readyUrl, setReadyUrl] = useState<string | null>(null);
    const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
    const [pdfError, setPdfError] = useState<string | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const committedNumPages = committedUrl ? pageCounts[committedUrl] ?? null : null;

    // Clear the buffer whenever the preview is reset (compile error, no .tex yet).
    useEffect(() => {
        setPdfError(null);

        if (pdfUrl) {
            return;
        }

        setCommittedUrl(null);
        setReadyUrl(null);
        setPageCounts({});
        setPageNumber(1);
        setScale(1);
    }, [pdfUrl]);

    // Mount the visible buffer plus, when a newer compile arrives, a hidden one
    // that preloads the next PDF before it is swapped in.
    const layerUrls = useMemo<string[]>(() => {
        const urls: string[] = [];

        if (committedUrl) {
            urls.push(committedUrl);
        }

        if (pdfUrl && pdfUrl !== committedUrl) {
            urls.push(pdfUrl);
        }

        return urls;
    }, [committedUrl, pdfUrl]);

    // Promote the preloaded buffer once it has rendered. Runs after paint, so the
    // previous PDF stays underneath until the new one fully covers it.
    useEffect(() => {
        if (readyUrl && readyUrl === pdfUrl) {
            setCommittedUrl((current) => current === readyUrl ? current : readyUrl);
        }
    }, [readyUrl, pdfUrl]);

    // Drop page counts for buffers that are no longer mounted.
    useEffect(() => {
        setPageCounts((current) => {
            const next: Record<string, number> = {};

            for (const url of layerUrls) {
                if (url in current) {
                    next[url] = current[url];
                }
            }

            return Object.keys(next).length === Object.keys(current).length ? current : next;
        });
    }, [layerUrls]);

    useEffect(() => {
        if (!committedNumPages) {
            return;
        }

        setPageNumber((currentPage) => Math.min(currentPage, committedNumPages));
    }, [committedNumPages]);

    const handleLayerLoadSuccess = useCallback((url: string, loadedPages: number): void => {
        setPdfError(null);
        setPageCounts((current) => current[url] === loadedPages
            ? current
            : { ...current, [url]: loadedPages });
    }, []);

    const handleLayerLoadError = useCallback((url: string, nextError: Error): void => {
        // Only surface failures for the visible PDF; ignore stale background buffers
        // so a broken recompile keeps the last good preview on screen.
        setCommittedUrl((current) => {
            if (current === null || current === url) {
                setPdfError(nextError.message || 'Failed to render PDF preview');
            }

            return current;
        });
    }, []);

    const handleBufferRendered = useCallback((url: string): void => {
        setReadyUrl((current) => current === url ? current : url);
    }, []);

    useEffect(() => {
        const root = stageRef.current;

        if (!root || !committedNumPages) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            let bestPage: number | null = null;
            let bestRatio = 0;

            for (const entry of entries) {
                if (!entry.isIntersecting) {
                    continue;
                }

                if (entry.intersectionRatio < bestRatio) {
                    continue;
                }

                const nextPage = Number((entry.target as HTMLElement).dataset.pageNumber);
                if (Number.isNaN(nextPage)) {
                    continue;
                }

                bestRatio = entry.intersectionRatio;
                bestPage = nextPage;
            }

            if (bestPage === null) {
                return;
            }

            setPageNumber((currentPage) => currentPage === bestPage ? currentPage : bestPage);
        }, {
            root,
            threshold: [0.2, 0.4, 0.6, 0.8]
        });

        const pages = root.querySelectorAll('[data-page-number]');
        pages.forEach((page) => observer.observe(page));

        return () => observer.disconnect();
    }, [committedNumPages, committedUrl, scale]);

    const toolbar = (
        <Row justify='between' gap='05' className='latex-pdf-toolbar'>
            <Row gap='05' className='latex-pdf-toolbar__group'>
                <span className='latex-pdf-toolbar__meta'>
                    Page {pageNumber}{committedNumPages ? ` / ${committedNumPages}` : ''}
                </span>
                <span className='latex-pdf-toolbar__hint'>Scroll to browse pages</span>
            </Row>

            <Row gap='05' className='latex-pdf-toolbar__group'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    shape='circle'
                    iconOnly
                    aria-label='Zoom out of the PDF preview'
                    disabled={scale <= MIN_SCALE}
                    onClick={() => setScale((currentScale) => Math.max(MIN_SCALE, Number((currentScale - SCALE_STEP).toFixed(2))))}
                    title='Zoom out'
                >
                    <ZoomOut size={14} />
                </Button>
                <span className='latex-pdf-toolbar__meta'>
                    {Math.round(scale * 100)}%
                </span>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    shape='circle'
                    iconOnly
                    aria-label='Zoom in to the PDF preview'
                    disabled={scale >= MAX_SCALE}
                    onClick={() => setScale((currentScale) => Math.min(MAX_SCALE, Number((currentScale + SCALE_STEP).toFixed(2))))}
                    title='Zoom in'
                >
                    <ZoomIn size={14} />
                </Button>
                {onDownload && (
                    <Button
                        variant='ghost'
                        intent='brand'
                        size='sm'
                        shape='rounded'
                        onClick={onDownload}
                        title={downloadLabel}
                    >
                        <Download size={12} />
                        {downloadLabel}
                    </Button>
                )}
            </Row>
        </Row>
    );

    if (error) {
        return (
            <Stack gap='05' p='1' overflow='y-auto' className='latex-compile-error'>
                <Row gap='05'>
                    <AlertCircle size={14} className='color-error' />
                    <Text as='span' size='sm' className='color-error latex-compile-error__title'>
                        Compilation failed
                    </Text>
                </Row>
                <pre className='latex-compile-error__log font-mono font-size-1 color-secondary'>
                    {error}
                </pre>
            </Stack>
        );
    }

    if (pdfError) {
        return (
            <Stack gap='05' p='1' overflow='y-auto' className='latex-compile-error'>
                <Row gap='05'>
                    <AlertCircle size={14} className='color-error' />
                    <Text as='span' size='sm' className='color-error latex-compile-error__title'>
                        PDF preview unavailable
                    </Text>
                </Row>
                <pre className='latex-compile-error__log font-mono font-size-1 color-secondary'>
                    {pdfError}
                </pre>
            </Stack>
        );
    }

    if (!pdfUrl && !committedUrl) {
        if (isLoading) {
            return (
                <Stack align='center' gap='2' className='latex-preview__empty flex-center'>
                    <Loader scale={0.5} isFixed={false} />
                    <Text as='p' size='sm' tone='muted'>Compiling document…</Text>
                </Stack>
            );
        }

        return (
            <Stack align='center' gap='05' p='2' className='latex-preview__empty flex-center'>
                <FileText size={28} className='color-muted' />
                <Text as='p' tone='muted' align='center' className='latex-preview__empty-text'>
                    Waiting for the first successful compile.
                </Text>
                <Text as='p' tone='muted' align='center' className='latex-preview__empty-text'>
                    Changes compile automatically in the background.
                </Text>
            </Stack>
        );
    }

    const hasVisiblePdf = !!committedUrl;

    return (
        <Stack flex='1' minH='0' className='latex-pdf-shell position-relative'>
            {hasVisiblePdf && toolbar}
            <Stack ref={stageRef} flex='1' minH='0' className='latex-pdf-stage position-relative'>
                <div className='latex-pdf-layers'>
                    {layerUrls.map((url) => {
                        const isCommitted = url === committedUrl;
                        const isVisible = isCommitted || url === readyUrl;
                        const isOnTop = !isCommitted && url === readyUrl;
                        const pages = pageCounts[url] ?? 0;
                        const className = [
                            'latex-pdf-document',
                            isVisible ? '' : 'latex-pdf-document--hidden',
                            isOnTop ? 'latex-pdf-document--top' : ''
                        ].filter(Boolean).join(' ');

                        return (
                            <Document
                                key={url}
                                file={url}
                                onLoadSuccess={({ numPages }) => handleLayerLoadSuccess(url, numPages)}
                                onLoadError={(loadError) => handleLayerLoadError(url, loadError)}
                                loading=''
                                error=''
                                className={className}
                                aria-hidden={isCommitted ? undefined : true}
                            >
                                {Array.from({ length: pages }, (_, index) => {
                                    const nextPageNumber = index + 1;

                                    return (
                                        <div
                                            key={`${url}-page-${nextPageNumber}`}
                                            className='latex-pdf-page-shell'
                                            data-page-number={isCommitted ? nextPageNumber : undefined}
                                        >
                                            <Page
                                                pageNumber={nextPageNumber}
                                                scale={scale}
                                                renderAnnotationLayer={false}
                                                renderTextLayer={false}
                                                className='latex-pdf-page'
                                                loading=''
                                                onRenderSuccess={!isCommitted && index === 0
                                                    ? () => handleBufferRendered(url)
                                                    : undefined}
                                            />
                                        </div>
                                    );
                                })}
                            </Document>
                        );
                    })}
                </div>

                {!committedUrl && !readyUrl && (
                    <Stack align='center' gap='2' className='latex-pdf-loading-overlay flex-center'>
                        <Loader scale={0.5} isFixed={false} />
                        <Text as='p' size='sm' tone='muted'>Compiling document…</Text>
                    </Stack>
                )}
            </Stack>
        </Stack>
    );
};

export default memo(LatexPdfViewer);
