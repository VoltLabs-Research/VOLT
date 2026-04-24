import Button from '@/shared/presentation/primitives/Button';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { AlertCircle, Download, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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

const PDF_LOADING_PLACEHOLDER = (
    <Stack align='center' gap='1' className='latex-preview__empty flex-center'>
        <Loader scale={0.5} isFixed={false} />
        <Text as='p' size='sm' tone='muted'>Loading PDF preview…</Text>
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
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        setPageNumber(1);
        setNumPages(null);
        setPdfError(null);
        setScale(1);
        pageRefs.current = [];
    }, [pdfUrl]);

    const handlePdfLoaded = useCallback(({ numPages: loadedPages }: { numPages: number }) => {
        setNumPages(loadedPages);
        setPdfError(null);
        setPageNumber((currentPage) => Math.min(currentPage, loadedPages));
    }, []);

    const handlePdfError = useCallback((nextError: Error) => {
        setPdfError(nextError.message || 'Failed to render PDF preview');
    }, []);

    const setPageRef = useCallback((index: number) => {
        return (node: HTMLDivElement | null) => {
            pageRefs.current[index] = node;
        };
    }, []);

    useEffect(() => {
        const root = stageRef.current;

        if (!root || !numPages) {
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

        pageRefs.current.slice(0, numPages).forEach((node) => {
            if (node) {
                observer.observe(node);
            }
        });

        return () => observer.disconnect();
    }, [numPages, pdfUrl, scale]);

    const toolbar = (
        <Row justify='between' gap='05' className='latex-pdf-toolbar'>
            <Row gap='05' className='latex-pdf-toolbar__group'>
                <span className='latex-pdf-toolbar__meta'>
                    Page {pageNumber}{numPages ? ` / ${numPages}` : ''}
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

    if (isLoading && !pdfUrl) {
        return (
            <Stack align='center' gap='2' className='latex-preview__empty flex-center'>
                <Loader scale={0.5} isFixed={false} />
                <Text as='p' size='sm' tone='muted'>Compiling document…</Text>
            </Stack>
        );
    }

    if (error) {
        return (
            <Stack gap='05' p='1' overflow='y-auto' className='latex-compile-error'>
                <Row gap='05'>
                    <AlertCircle size={14} className='color-error' />
                    <span className='font-size-1 color-error latex-compile-error__title'>
                        Compilation failed
                    </span>
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
                    <span className='font-size-1 color-error latex-compile-error__title'>
                        PDF preview unavailable
                    </span>
                </Row>
                <pre className='latex-compile-error__log font-mono font-size-1 color-secondary'>
                    {pdfError}
                </pre>
            </Stack>
        );
    }

    if (!pdfUrl) {
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
            {toolbar}
            <div ref={stageRef} className='latex-pdf-stage d-flex column flex-1 min-h-0'>
                <Document
                    key={pdfUrl}
                    file={pdfUrl}
                    onLoadSuccess={handlePdfLoaded}
                    onLoadError={handlePdfError}
                    loading={PDF_LOADING_PLACEHOLDER}
                    error=''
                    className='latex-pdf-document'
                >
                    {Array.from({ length: numPages ?? 0 }, (_, index) => {
                        const nextPageNumber = index + 1;

                        return (
                            <div key={`${pdfUrl}-page-${nextPageNumber}`} ref={setPageRef(index)} className='latex-pdf-page-shell' data-page-number={nextPageNumber}>
                                <Page
                                    pageNumber={nextPageNumber}
                                    scale={scale}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={false}
                                    className='latex-pdf-page'
                                    loading=''
                                />
                            </div>
                        );
                    })}
                </Document>
            </div>
        </Stack>
    );
};

export default memo(LatexPdfViewer);
