import { Button, Row } from '@voltstack/bravais';
import { Download, ZoomIn, ZoomOut } from 'lucide-react';

interface LatexPdfToolbarProps {
    pageNumber: number;
    numPages: number | null;
    scale: number;
    onScaleChange: (scale: number) => void;
    onDownload?: () => void;
    downloadLabel: string;
}

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;

const stepScale = (scale: number, direction: 1 | -1): number => {
    const next = Number((scale + direction * SCALE_STEP).toFixed(2));
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
};

/** Page indicator and zoom controls of the PDF preview. */
const LatexPdfToolbar = ({
    pageNumber,
    numPages,
    scale,
    onScaleChange,
    onDownload,
    downloadLabel
}: LatexPdfToolbarProps) => (
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
                onClick={() => onScaleChange(stepScale(scale, -1))}
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
                onClick={() => onScaleChange(stepScale(scale, 1))}
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

export default LatexPdfToolbar;
