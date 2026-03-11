import Container from '@/shared/presentation/components/Container';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import Loader from '@/shared/presentation/components/Loader';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, FileText, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useEffect, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface LatexPreviewPanelProps {
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onCompile: () => void;
    width: number;
};

const PREVIEW_ICON = <Eye size={14} />;
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;

/** Renders the PDF preview panel — compile state, error log, or the compiled PDF iframe. */
const LatexPreviewPanel = ({
    isCompiling,
    compiledPdfUrl,
    compileError,
    onCompile,
    width
}: LatexPreviewPanelProps) => {
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        setPageNumber(1);
        setNumPages(null);
        setPdfError(null);
        setScale(1);
    }, [compiledPdfUrl]);

    const compileButton = (
        <Button
            variant='ghost'
            intent='brand'
            size='sm'
            shape='rounded'
            disabled={isCompiling}
            onClick={onCompile}
            title='Compile to PDF'
        >
            <Play size={12} />
            {isCompiling ? 'Compiling...' : 'Compile'}
        </Button>
    );

    const handlePdfLoaded = ({ numPages: loadedPages }: { numPages: number }) => {
        setNumPages(loadedPages);
        setPdfError(null);
        setPageNumber((currentPage) => Math.min(currentPage, loadedPages));
    };

    const handlePdfError = (error: Error) => {
        setPdfError(error.message || 'Failed to render PDF preview');
    };

    const canGoPrevious = pageNumber > 1;
    const canGoNext = numPages !== null && pageNumber < numPages;

    const renderPdfToolbar = () => (
        <Container className='latex-pdf-toolbar d-flex items-center content-between gap-05'>
            <Container className='d-flex items-center gap-05'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    shape='circle'
                    iconOnly
                    disabled={!canGoPrevious}
                    onClick={() => setPageNumber((currentPage) => Math.max(1, currentPage - 1))}
                    title='Previous page'
                >
                    <ChevronLeft size={14} />
                </Button>
                <span className='latex-pdf-toolbar__meta'>
                    Page {pageNumber}{numPages ? ` / ${numPages}` : ''}
                </span>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    shape='circle'
                    iconOnly
                    disabled={!canGoNext}
                    onClick={() => setPageNumber((currentPage) => Math.min(numPages ?? currentPage, currentPage + 1))}
                    title='Next page'
                >
                    <ChevronRight size={14} />
                </Button>
            </Container>

            <Container className='d-flex items-center gap-05'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    shape='circle'
                    iconOnly
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
                    disabled={scale >= MAX_SCALE}
                    onClick={() => setScale((currentScale) => Math.min(MAX_SCALE, Number((currentScale + SCALE_STEP).toFixed(2))))}
                    title='Zoom in'
                >
                    <ZoomIn size={14} />
                </Button>
            </Container>
        </Container>
    );

    const renderContent = () => {
        if (isCompiling) {
            return (
                <Container className='latex-preview__empty d-flex column flex-center items-center gap-1'>
                    <Loader scale={0.5} isFixed={false} />
                    <Paragraph className='color-muted font-size-1'>Compiling document…</Paragraph>
                </Container>
            );
        }

        if (compileError) {
            return (
                <Container className='latex-compile-error d-flex column gap-05 p-1 overflow-y-auto'>
                    <Container className='d-flex items-center gap-05'>
                        <AlertCircle size={14} className='color-error' />
                        <span className='font-size-1 color-error latex-compile-error__title'>
                            Compilation failed
                        </span>
                    </Container>
                    <pre className='latex-compile-error__log font-size-1 color-secondary'>
                        {compileError}
                    </pre>
                </Container>
            );
        }

        if (pdfError) {
            return (
                <Container className='latex-compile-error d-flex column gap-05 p-1 overflow-y-auto'>
                    <Container className='d-flex items-center gap-05'>
                        <AlertCircle size={14} className='color-error' />
                        <span className='font-size-1 color-error latex-compile-error__title'>
                            PDF preview unavailable
                        </span>
                    </Container>
                    <pre className='latex-compile-error__log font-size-1 color-secondary'>
                        {pdfError}
                    </pre>
                </Container>
            );
        }

        if (!compiledPdfUrl) {
            return (
                <Container className='latex-preview__empty d-flex column flex-center items-center gap-05 p-2'>
                    <FileText size={28} className='color-muted' />
                    <Paragraph className='color-muted font-size-1 text-center'>
                        No compiled PDF yet.
                    </Paragraph>
                    <Paragraph className='color-muted font-size-1 text-center'>
                        Click <strong>Compile</strong> to generate the PDF.
                    </Paragraph>
                </Container>
            );
        }

        return (
            <Container className='latex-pdf-shell d-flex column flex-1 min-h-0'>
                {renderPdfToolbar()}
                <Container className='latex-pdf-stage d-flex column flex-1 min-h-0'>
                    <Document
                        key={compiledPdfUrl}
                        file={compiledPdfUrl}
                        onLoadSuccess={handlePdfLoaded}
                        onLoadError={handlePdfError}
                        loading={
                            <Container className='latex-preview__empty d-flex column flex-center items-center gap-1'>
                                <Loader scale={0.5} isFixed={false} />
                                <Paragraph className='color-muted font-size-1'>Loading PDF preview…</Paragraph>
                            </Container>
                        }
                        error=''
                        className='latex-pdf-document'
                    >
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderAnnotationLayer={false}
                            renderTextLayer={false}
                            className='latex-pdf-page'
                            loading=''
                        />
                    </Document>
                </Container>
            </Container>
        );
    };

    return (
        <Container className='latex-workspace__preview d-flex column' style={{ width }}>
            <PanelHeader
                variant='compact'
                icon={PREVIEW_ICON}
                title='Preview'
                actions={compileButton}
            />
            <Container className='latex-preview__content d-flex column flex-1 min-h-0'>
                {renderContent()}
            </Container>
        </Container>
    );
};

export default LatexPreviewPanel;
