import { EmptyStateRoot } from '@heroui/react';
import { Container } from 'lucide-react';
import { useId } from 'react';

interface DockerNeededStateProps {
    feature: string;
};

const DockerNeededState = ({ feature }: DockerNeededStateProps) => {
    const headingId = useId();

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className='flex flex-row items-center justify-center w-full h-full max-md:min-h-[300px]'
        >
            <div className='flex flex-col items-center gap-6 text-center max-w-[420px] max-md:max-w-[90%]'>
                <div className='flex flex-row items-center justify-center size-14 shrink-0 rounded-2xl bg-surface-tertiary text-muted'>
                    <Container size={24} />
                </div>
                <div className='flex flex-col gap-2 text-center'>
                    <h2 className='text-base font-medium text-foreground' id={headingId}>
                        {`${feature} needs a container runtime`}
                    </h2>
                    <span className='text-sm text-muted leading-normal'>
                        This cluster&apos;s machine has no container runtime available, so Volt cannot start
                        containers on it. Install Docker there and this page works on the next heartbeat.
                    </span>
                    <span className='text-xs text-muted leading-normal'>
                        Nothing else is affected: trajectories, analyses and plugins do not use containers.
                    </span>
                </div>
            </div>
        </EmptyStateRoot>
    );
};

export default DockerNeededState;
