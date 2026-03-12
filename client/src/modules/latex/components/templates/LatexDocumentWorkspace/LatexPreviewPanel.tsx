import { memo } from 'react';
import Container from '@/shared/presentation/components/Container';
import LatexPdfViewer from './LatexPdfViewer';

interface LatexPreviewPanelProps {
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onExportPdf: () => void;
    width: number;
};

const LatexPreviewPanel = ({
    isCompiling,
    compiledPdfUrl,
    compileError,
    onExportPdf,
    width
}: LatexPreviewPanelProps) => (
    <Container className='latex-workspace__preview d-flex column' style={{ width }}>
        <Container className='latex-preview__content d-flex column flex-1 min-h-0'>
            <LatexPdfViewer
                pdfUrl={compiledPdfUrl}
                isLoading={isCompiling}
                error={compileError}
                onDownload={compiledPdfUrl ? onExportPdf : undefined}
            />
        </Container>
    </Container>
);

export default memo(LatexPreviewPanel);
