import { cn } from '@/shared/utils/cn';
import { Loader, Row, Stack, Text } from '@voltstack/bravais';
import LatexPdfToolbar from './LatexPdfToolbar';
import { AlertCircle, FileText } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface LatexPdfViewerProps {
    pdfUrl: string | null;
    isLoading?: boolean;
    error?: string | null;
    onDownload?: () => void;
    downloadLabel?: string;
}

const compilingPlaceholder = (
    <Stack align='center' gap='2' className='latex-preview__empty flex-center'>
        <Loader scale={0.5} isFixed={false} />
        <Text as='p' size='sm' tone='muted'>Compiling document…</Text>
    </Stack>
);

const renderFailure = (title: string, detail: string) => (
    <Stack gap='05' p='1' overflow='y-auto' className='latex-compile-error'>
        <Row gap='05'>
            <AlertCircle size={14} className='color-error' />
            <Text as='span' size='sm' className='color-error latex-compile-error__title'>
                {title}
            </Text>
        </Row>
        <pre className='latex-compile-error__log font-mono font-size-1 color-secondary'>
            {detail}
        </pre>
    </Stack>
);

const LatexPdfViewer = ({
    pdfUrl,
    isLoading = false,
    error = null,
    onDownload,
    downloadLabel = 'Export PDF'
}: LatexPdfViewerProps) => {
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1);
    const [committedUrl, setCommittedUrl] = useState<string | null>(null);
    const [readyUrl, setReadyUrl] = useState<string | null>(null);
    const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
    const [pdfError, setPdfError] = useState<string | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const committedNumPages = committedUrl ? pageCounts[committedUrl] ?? null : null;

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

    useEffect(() => {
        if (readyUrl && readyUrl === pdfUrl) {
            setCommittedUrl((current) => current === readyUrl ? current : readyUrl);
        }
    }, [readyUrl, pdfUrl]);

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

    const handleLayerLoadSuccess = (url: string, loadedPages: number): void => {
        setPdfError(null);
        setPageCounts((current) => current[url] === loadedPages
            ? current
            : {
                ...current,
                [url]: loadedPages
            });
    };

    const handleLayerLoadError = (url: string, nextError: Error): void => {
        setCommittedUrl((current) => {
            if (current === null || current === url) {
                setPdfError(nextError.message || 'Failed to render PDF preview');
            }

            return current;
        });
    };

    const handleBufferRendered = (url: string): void => {
        setReadyUrl((current) => current === url ? current : url);
    };

    useEffect(() => {
        const root = stageRef.current;

        if (!root || !committedNumPages) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            let bestPage: number | null = null;
            let bestRatio = 0;

            for (const entry of entries) {
                if (!entry.isIntersecting || entry.intersectionRatio < bestRatio) {
                    continue;
                }

                bestRatio = entry.intersectionRatio;
                bestPage = Number((entry.target as HTMLElement).dataset.pageNumber);
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
        <LatexPdfToolbar
            pageNumber={pageNumber}
            numPages={committedNumPages}
            scale={scale}
            onScaleChange={setScale}
            onDownload={onDownload}
            downloadLabel={downloadLabel}
        />
    );

    if (error) {
        return renderFailure('Compilation failed', error);
    }

    if (pdfError) {
        return renderFailure('PDF preview unavailable', pdfError);
    }

    if (!pdfUrl && !committedUrl) {
        if (isLoading) {
            return compilingPlaceholder;
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

    return (
        <Stack flex='1' minH='0' className='latex-pdf-shell position-relative'>
            {committedUrl && toolbar}
            <Stack ref={stageRef} flex='1' minH='0' className='latex-pdf-stage position-relative'>
                <div className='latex-pdf-layers'>
                    {layerUrls.map((url) => {
                        const isCommitted = url === committedUrl;
                        const isVisible = isCommitted || url === readyUrl;
                        const isOnTop = !isCommitted && url === readyUrl;
                        const pages = pageCounts[url] ?? 0;
                        const className = cn(
                            'latex-pdf-document',
                            isVisible ? '' : 'latex-pdf-document--hidden',
                            isOnTop ? 'latex-pdf-document--top' : ''
                        );

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
                )}            </Stack>
        </Stack>
    );
};

export default memo(LatexPdfViewer);
