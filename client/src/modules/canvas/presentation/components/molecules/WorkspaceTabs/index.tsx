import { useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';

const TABS: [string, string | null][] = [
    ['Dashboard', '/dashboard'],
    ['Scene', null]
];

const WorkspaceTabs = () => {
    const navigate = useNavigate();

    return (
        <Container className="d-flex items-center px-1 gap-025">
            {TABS.map(([label, path]) => (
                <Button
                    key={label}
                    variant={path ? 'ghost' : 'solid'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-05 canvas-btn-compact"
                    onClick={path ? () => navigate(path) : undefined}
                >
                    {label}
                </Button>
            ))}
        </Container>
    );
};

export default WorkspaceTabs;
