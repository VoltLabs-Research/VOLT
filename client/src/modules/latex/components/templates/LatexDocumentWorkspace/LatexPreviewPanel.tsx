import Container from '@/shared/presentation/components/Container';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Eye } from 'lucide-react';

const PREVIEW_ICON = <Eye size={14} />;

/** Placeholder for Phase 3 PDF/math preview panel. */
const LatexPreviewPanel = () => (
    <Container className='latex-workspace__preview d-flex column'>
        <PanelHeader
            variant='compact'
            icon={PREVIEW_ICON}
            title='Preview'
        />
        <Container className='latex-workspace__preview-placeholder d-flex column flex-center items-center gap-05 p-2'>
            <Eye size={32} className='color-muted' />
            <Paragraph className='color-muted font-size-1 text-center'>
                PDF preview coming in a future phase.
            </Paragraph>
        </Container>
    </Container>
);

export default LatexPreviewPanel;
