import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import './NotFoundState.css';
import { SearchX } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundState = () => {
    const navigate = useNavigate();
    const headingId = useId();

    usePageTitle('Page Not Found');

    return (
        <section aria-labelledby={headingId} className='not-found-state d-flex items-center content-center vh-max w-max'>
            <Container className='not-found-state-content d-flex column gap-1-5 items-center text-center'>
                <Container className='not-found-state-icon d-flex items-center content-center'>
                    <SearchX size={24} />
                </Container>

                <Container className='d-flex column gap-05 text-center'>
                    <Title as='h1' id={headingId} className='font-size-3 font-weight-5 color-primary'>
                        Page not found
                    </Title>
                    <Paragraph className='font-size-2 color-secondary line-height-5'>
                        The page you were looking for is unavailable or may have moved.
                    </Paragraph>
                    <Paragraph className='font-size-2 color-muted'>
                        You can go back or return to the dashboard.
                    </Paragraph>
                </Container>

                <Container className='d-flex gap-075 items-center mt-05'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        to='/dashboard'
                    >
                        Go to dashboard
                    </Button>
                </Container>
            </Container>
        </section>
    );
};

export default NotFoundState;
