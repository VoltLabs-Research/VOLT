import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';

const WorkspaceTabs = () => (
    <Container className="d-flex items-center px-1">
        <Button
            variant="solid"
            intent="canvas"
            size="sm"
            shape="rounded"
            className="font-size-05 canvas-btn-compact"
        >
            Scene
        </Button>
    </Container>
);

export default WorkspaceTabs;
