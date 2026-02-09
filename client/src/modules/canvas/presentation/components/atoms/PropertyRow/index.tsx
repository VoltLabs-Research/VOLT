import Container from '@/shared/presentation/components/Container';
import './PropertyRow.css';

interface PropertyRowProps {
    label: string;
    labelWidth?: '60' | '72';
    children: React.ReactNode;
}

const PropertyRow = ({ label, labelWidth = '60', children }: PropertyRowProps) => (
    <Container className="d-flex items-center gap-1 p-025">
        <span className={`canvas-prop-label-${labelWidth} font-size-05 color-muted text-right`}>{label}</span>
        <Container className="d-flex items-center flex-1 gap-05">{children}</Container>
    </Container>
);

export default PropertyRow;
