import { memo } from 'react';
import Container from '@/shared/presentation/components/Container';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Button from '@/shared/presentation/components/Button';
import { Download, Eye } from 'lucide-react';
import LatexPdfViewer from './LatexPdfViewer';

interface LatexPreviewPanelProps {
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onExportPdf: () => void;
    width: number;
};

const PREVIEW_ICON = <Eye size={14} />;
const LatexPreviewPanel = ({
    isCompiling,
    compiledPdfUrl,
    compileError,
    onExportPdf,
    width
}: LatexPreviewPanelProps) => {
    const exportButton = (
        <Button
            variant='ghost'
            intent='brand'
            size='sm'
            shape='rounded'
            disabled={isCompiling || !compiledPdfUrl}
            onClick={onExportPdf}
            title='Export PDF'
        >
            <Download size={12} />
            Export PDF
        </Button>
    );

    return (
        <Container className='latex-workspace__preview d-flex column' style={{ width }}>
            <PanelHeader
                variant='compact'
                icon={PREVIEW_ICON}
                title='Preview'
                actions={exportButton}
            />
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
};

export default memo(LatexPreviewPanel);
