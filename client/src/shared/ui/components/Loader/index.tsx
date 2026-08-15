import { ProgressCircle } from '@heroui/react';
import type { ProgressCircleProps } from '@heroui/react';

type LoaderColor = ProgressCircleProps['color'] | 'current';

interface LoaderProps {
    size?: ProgressCircleProps['size'];
    color?: LoaderColor;
    className?: string;
    'aria-label'?: string;
}

const Loader = ({
    size = 'sm',
    color,
    className,
    'aria-label': ariaLabel = 'Loading'
}: LoaderProps) => {
    const inheritsTextColor = color === 'current';

    return (
        <ProgressCircle
            isIndeterminate
            aria-label={ariaLabel}
            size={size}
            color={inheritsTextColor ? undefined : color}
            className={className}
        >
            <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle
                    className={inheritsTextColor ? '[stroke:currentColor]' : undefined}
                />
            </ProgressCircle.Track>
        </ProgressCircle>
    );
};

export default Loader;
