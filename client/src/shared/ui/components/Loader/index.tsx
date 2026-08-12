import { ProgressCircle } from '@heroui/react';
import type { ProgressCircleProps } from '@heroui/react';

/**
 * `current` is not one of HeroUI's colours; it means "inherit the surrounding text
 * colour", which is what a loader inside a button needs so it matches the label. The
 * spinner this replaced accepted it natively, and most call sites ask for it, so it is
 * kept here and translated into a stroke override on the ring itself.
 */
type LoaderColor = ProgressCircleProps['color'] | 'current';

interface LoaderProps {
    size?: ProgressCircleProps['size'];
    color?: LoaderColor;
    className?: string;
    'aria-label'?: string;
}

/**
 * The indeterminate loading indicator, as a progress ring.
 *
 * HeroUI's `ProgressCircle` is a compound component — a track, a track circle and a fill
 * circle — so using it directly would put five lines of markup at every call site, and
 * there are thirty-odd. Wrapping it once keeps those call sites to one line and leaves a
 * single place to change if the look changes again.
 *
 * `aria-label` has a default because the underlying react-aria progress bar has no
 * visible label of its own; without one the control is unnamed for a screen reader.
 */
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
