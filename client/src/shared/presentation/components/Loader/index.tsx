import Container from '@/shared/presentation/components/Container';
import './Loader.css';
import { useId } from 'react';

interface LoaderProps {
    scale: number;
    isFixed?: boolean;
    className?: string;
    label?: string;
    announce?: boolean;
    reducedMotionLabel?: string;
};

const Loader = ({
    scale,
    isFixed = true,
    className = '',
    label,
    announce = false,
    reducedMotionLabel = 'Loading'
}: LoaderProps) => {
    const loaderItems = Array.from({ length: 12 }, (_, index) => index + 1);
    const statusId = useId();
    const statusLabel = label ?? 'Loading';

    let accessibilityProps = {};
    if (announce) {
        accessibilityProps = {
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': true,
            'aria-label': label ? undefined : statusLabel,
            'aria-labelledby': label ? statusId : undefined
        };
    }

    return (
        <Container className={`d-flex flex-center ${isFixed ? 'p-fixed inset-0' : ''} ${className}`} {...accessibilityProps}>
            <Container className='d-flex column items-center gap-075 loader-content'>
                <Container className='p-relative loader-visual' style={{ transform: `scale(${scale})` }}>
                    {loaderItems.map((item) => (
                        <Container
                            key={item}
                            className={`p-absolute Loader-Item Loader-Item-${item}`} />
                    ))}
                </Container>

                {label && (
                    <span id={statusId} className='loader-label font-size-2 color-secondary text-center line-height-5'>
                        {label}
                    </span>
                )}
                <span className='loader-reduced-motion-label'>
                    {reducedMotionLabel}
                </span>
            </Container>
        </Container>
    );
};

export default Loader;
