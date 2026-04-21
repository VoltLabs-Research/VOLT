import { memo } from 'react';
import LatexPdfViewer from './LatexPdfViewer';

interface LatexPreviewPanelProps {
    panelId: string;
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onExportPdf: () => void;
    width: number;
};

const LatexPreviewPanel = ({
    panelId,
    isCompiling,
    compiledPdfUrl,
    compileError,
    onExportPdf,
    width
}: LatexPreviewPanelProps) => (
    <div id={panelId} className='volt-container latex-workspace__preview d-flex column' style={{ width }} aria-label='PDF preview panel'>
        <div className='volt-container latex-preview__content d-flex column flex-1 min-h-0'>
            <LatexPdfViewer
                pdfUrl={compiledPdfUrl}
                isLoading={isCompiling}
                error={compileError}
                onDownload={compiledPdfUrl ? onExportPdf : undefined}
            />
        </div>
    </div>
);

export default memo(LatexPreviewPanel);
