import { parseLatexSegments } from '@/modules/latex/utilities/parse-math';
import Container from '@/shared/presentation/components/Container';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import Loader from '@/shared/presentation/components/Loader';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { AlertCircle, Eye, FileText, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LatexSegment } from '@/modules/latex/utilities/parse-math';

interface LatexPreviewPanelProps {
    content: string;
    isCompiling: boolean;
    compiledPdfUrl: string | null;
    compileError: string | null;
    onCompile: () => void;
};

enum PreviewTab {
    Math = 'math',
    Pdf = 'pdf'
};

const PREVIEW_ICON = <Eye size={14} />;

const renderSegment = (segment: LatexSegment, index: number) => {
    if (segment.type === 'block-math') {
        return (
            <div key={index} className='latex-preview__block-math'>
                <BlockMath math={segment.content} errorColor='var(--color-error)' />
            </div>
        );
    }

    if (segment.type === 'inline-math') {
        return (
            <span key={index} className='latex-preview__inline-math'>
                <InlineMath math={segment.content} errorColor='var(--color-error)' />
            </span>
        );
    }

    return (
        <Paragraph key={index} className='latex-preview__text color-secondary font-size-1'>
            {segment.content}
        </Paragraph>
    );
};

/** Renders the preview panel with two tabs: math preview (KaTeX) and compiled PDF. */
const LatexPreviewPanel = ({
    content,
    isCompiling,
    compiledPdfUrl,
    compileError,
    onCompile
}: LatexPreviewPanelProps) => {
    const [activeTab, setActiveTab] = useState<PreviewTab>(PreviewTab.Math);
    const segments = useMemo(() => parseLatexSegments(content), [content]);
    const hasMath = segments.some((s) => s.type !== 'text');

    const tabs = [
        {
            label: 'Math',
            active: activeTab === PreviewTab.Math,
            onClick: () => setActiveTab(PreviewTab.Math)
        },
        {
            label: 'PDF',
            active: activeTab === PreviewTab.Pdf,
            onClick: () => setActiveTab(PreviewTab.Pdf)
        }
    ];

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

    const renderMathTab = () => {
        if (!hasMath) {
            return (
                <Container className='latex-preview__empty d-flex column flex-center items-center gap-05 p-2'>
                    <Eye size={28} className='color-muted' />
                    <Paragraph className='color-muted font-size-1 text-center'>
                        No math expressions detected yet.
                    </Paragraph>
                    <Paragraph className='color-muted font-size-1 text-center'>
                        Use <code>$...$</code>, <code>$$...$$</code>, or environments like{' '}
                        <code>equation</code>, <code>align</code> in the editor.
                    </Paragraph>
                </Container>
            );
        }

        return (
            <Container className='latex-preview__content d-flex column gap-075 p-1 overflow-y-auto'>
                {segments.map(renderSegment)}
            </Container>
        );
    };

    const renderPdfTab = () => {
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
                        <span className='font-size-1 color-error' style={{ fontWeight: 600 }}>
                            Compilation failed
                        </span>
                    </Container>
                    <pre className='latex-compile-error__log font-size-1 color-secondary'>
                        {compileError}
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
                        Click <strong>Compile</strong> to generate the PDF from your document.
                    </Paragraph>
                </Container>
            );
        }

        return (
            <iframe
                key={compiledPdfUrl}
                src={compiledPdfUrl}
                className='latex-pdf-viewer'
                title='Compiled PDF'
            />
        );
    };

    return (
        <Container className='latex-workspace__preview d-flex column'>
            <PanelHeader
                variant='compact'
                icon={PREVIEW_ICON}
                title='Preview'
                tabs={tabs}
                actions={compileButton}
            />

            <Container className='latex-preview__tab-content d-flex column flex-1 min-h-0'>
                {activeTab === PreviewTab.Math ? renderMathTab() : renderPdfTab()}
            </Container>
        </Container>
    );
};

export default LatexPreviewPanel;

