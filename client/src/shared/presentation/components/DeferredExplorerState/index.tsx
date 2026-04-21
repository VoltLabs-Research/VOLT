import Button from '@/shared/presentation/components/Button';
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
        <div className='volt-container d-flex column gap-1 p-2 flex-1 justify-center'>
            <h3 className="volt-title" order={4}>{title}</h3>
            <p className='volt-text color-secondary'>
                {body}
            </p>
            {actionButton}
        </div>
    );
};

export default DeferredExplorerState;
