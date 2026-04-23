import { Button, Heading, Row, Stack, Text } from '@/shared/presentation/primitives';
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
            <Stack align='center' gap='1-5' textAlign='center' className='not-found-state-content'>
                <Row justify='center' className='not-found-state-icon'>
                    <SearchX size={24} />
                </Row>

                <Stack gap='05' textAlign='center'>
                    <Heading level={1} id={headingId}>
                        Page not found
                    </Heading>
                    <Text as='p' size='md' tone='secondary' lineHeight='5'>
                        The page you were looking for is unavailable or may have moved.
                    </Text>
                    <Text as='p' size='md' tone='muted'>
                        You can go back or return to the dashboard.
                    </Text>
                </Stack>

                <Row gap='075' mt='05'>
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
                </Row>
            </Stack>
        </section>
    );
};

export default NotFoundState;
