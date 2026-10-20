import { Button, EmptyStateRoot, buttonVariants } from '@heroui/react';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { SearchX } from 'lucide-react';
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
            <div className='flex flex-col items-center gap-6 text-center max-w-96 max-md:max-w-[90%]'>
                <div className='flex flex-row items-center justify-center shrink-0 text-muted'>
                    <SearchX size={24} />
                </div>

                <div className='flex flex-col gap-2 text-center'>
                    <h1 className='text-base font-medium text-foreground' id={headingId}>
                        Page not found
                    </h1>
                    <p className='text-sm text-muted leading-normal'>
                        The page you were looking for is unavailable or may have moved.
                    </p>
                    <p className='text-sm text-muted'>
                        You can go back or return to the dashboard.
                    </p>
                </div>

                <div className='flex flex-row items-center gap-3 mt-2'>
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
