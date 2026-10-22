import { Button, EmptyStateRoot, buttonVariants } from '@heroui/react';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
const NotFoundState = () => {
    const navigate = useNavigate();
    const headingId = useId();

    usePageTitle('Page Not Found');

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className='flex items-center justify-center h-dvh w-full min-h-full max-md:min-h-[300px]'
        >
            <div className='flex flex-col items-center gap-5 text-center max-w-md max-md:max-w-[90%]'>
                <span className='font-mono text-sm text-muted'>404</span>

                <div className='flex flex-col gap-2 text-center'>
                    <h1 className='text-2xl font-semibold tracking-tight text-foreground' id={headingId}>
                        Page not found
                    </h1>
                    <p className='text-sm text-muted text-pretty'>
                        The page you were looking for is unavailable or may have moved.
                    </p>
                </div>

                <div className='flex flex-row items-center gap-2'>
                    <Button
                        variant='ghost'
                        size='sm'
                        onPress={() => navigate(-1)}
                    >
                        Back
                    </Button>
                    <Link
                        to='/dashboard'
                        className={buttonVariants({ variant: 'primary', size: 'sm' })}
                    >
                        Go to dashboard
                    </Link>
                </div>
            </div>
        </EmptyStateRoot>
    );
};

export default NotFoundState;
