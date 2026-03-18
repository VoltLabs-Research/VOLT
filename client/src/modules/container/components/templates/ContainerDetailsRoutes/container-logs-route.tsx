import useContainerDetailsContext from '../../../hooks/use-container-details-context';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { FileText, Terminal } from 'lucide-react';

const ContainerLogsPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if (!isRunning) {
        return (
            <EmptyState
                icon={<FileText size={48} />}
                title='Container not running'
                description='Start the container to generate runtime logs for this view.'
            />
        );
    }

    return (
        <Container className='h-max d-flex flex-center p-2'>
            <Container className='d-flex column items-center gap-1 text-center mw-100' style={{ maxWidth: '32rem' }}>
                <EmptyState
                    icon={<FileText size={48} />}
                    title='Logs view is separate from the terminal'
                    description={`Runtime logs for ${container.name} are not exposed in the terminal anymore.`}
                />
                <Paragraph className='color-secondary'>
                    Use the Terminal tab for interactive shell access. This Logs tab is reserved for a dedicated read-only log stream.
                </Paragraph>
                <Container className='d-flex items-center gap-05 color-muted font-size-2'>
                    <Terminal size={14} />
                    <span>Interactive shell access stays in the Terminal tab.</span>
                </Container>
            </Container>
        </Container>
    );
};

export default ContainerLogsPage;
