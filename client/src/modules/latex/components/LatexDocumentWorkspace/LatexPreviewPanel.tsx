import { Stack } from '@voltstack/bravais';
import { memo } from 'react';
import LatexPdfViewer from './LatexPdfViewer';

interface LatexPreviewPanelProps {
    panelId: string;
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onExportPdf: () => void;
    width: number;
}

const LatexPreviewPanel = ({
    panelId,
    isCompiling,
    compiledPdfUrl,
    compileError,
    onExportPdf,
    width
}: LatexPreviewPanelProps) => (
    <Stack id={panelId} className='latex-workspace__preview' style={{ width }} aria-label='PDF preview panel'>
        <Stack flex='1' minH='0' className='latex-preview__content'>
            <LatexPdfViewer
                pdfUrl={compiledPdfUrl}
                isLoading={isCompiling}
                error={compileError}
                onDownload={compiledPdfUrl ? onExportPdf : undefined}
            />
        </Stack>
    </Stack>
);

export default memo(LatexPreviewPanel);
