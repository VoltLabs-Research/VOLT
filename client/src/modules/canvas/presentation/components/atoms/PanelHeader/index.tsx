import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './PanelHeader.css';

interface PanelHeaderProps {
    icon: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
}

const PanelHeader = ({ icon, title, actions }: PanelHeaderProps) => (
    <Container className="canvas-panel-header d-flex items-center content-between panel-header-bordered">
        <Container className="d-flex items-center gap-05">
            <span className="canvas-panel-header-icon d-flex items-center">{icon}</span>
            <Paragraph className="canvas-panel-header-title font-size-05 color-muted">{title}</Paragraph>
        </Container>
        {actions && <Container className="d-flex items-center gap-05">{actions}</Container>}
    </Container>
);

export default PanelHeader;
