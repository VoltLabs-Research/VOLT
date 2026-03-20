import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';

interface DeferredExplorerStateProps {
    body: string;
    ctaLabel?: string;
    onActivate?: () => void;
    title: string;
};

const DeferredExplorerState = ({
    body,
    ctaLabel,
    onActivate,
    title
}: DeferredExplorerStateProps) => {
    const actionButton = ctaLabel && onActivate
        ? <Button onClick={onActivate} className='w-fit'>{ctaLabel}</Button>
        : null;

    return (
        <Container className='d-flex column gap-1 p-2 flex-1 justify-center'>
            <Title order={4}>{title}</Title>
            <Paragraph className='color-secondary'>
                {body}
            </Paragraph>
            {actionButton}
        </Container>
    );
};

export default DeferredExplorerState;
