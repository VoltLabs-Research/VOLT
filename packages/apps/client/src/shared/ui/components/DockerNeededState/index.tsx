import { EmptyStateRoot } from '@heroui/react';
import { Container } from 'lucide-react';
import { useId } from 'react';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';

interface DockerNeededStateProps {
    feature: string;
};

const DockerNeededState = ({ feature }: DockerNeededStateProps) => {
    const headingId = useId();
    const singleTenant = useSingleTenant();

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className='flex flex-row items-center justify-center w-full h-full max-md:min-h-[300px]'
        >
            <div className='flex flex-col items-center text-center max-w-md max-md:max-w-[90%]'>
                <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground/6 text-foreground' aria-hidden='true'>
                    <Container size={24} />
                </div>
                <h2 className='mt-5 text-base font-medium text-foreground' id={headingId}>
                    {`${feature} needs a container runtime`}
                </h2>
                <p className='mt-2 text-base text-muted text-pretty'>
                    {singleTenant
                        ? 'This computer has no container runtime available, so Volt cannot start containers. Install Docker Desktop and this page works on the next heartbeat.'
                        : 'This cluster\u2019s machine has no container runtime available, so Volt cannot start containers on it. Install Docker there and this page works on the next heartbeat.'}
                </p>
                <p className='mt-2 text-sm text-muted text-pretty'>
                    Nothing else is affected: trajectories, analyses and plugins do not use containers.
                </p>
            </div>
        </EmptyStateRoot>
    );
};

export default DockerNeededState;
