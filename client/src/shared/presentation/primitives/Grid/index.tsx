import Box from '../Box';
import { forwardRef } from 'react';
import type { BoxProps } from '../Box';
import type { CSSProperties, ElementType, ReactElement, Ref } from 'react';

type GridColumns = 2 | 3 | 4 | 'auto-fit' | 'auto-fill';

/**
 * CSS-grid layout primitive. Defaults to `d-grid` and accepts every `Box` style prop
 * (gap, padding, etc.). Use `columns` for fixed/auto tracks; `minColumnWidth` tunes the
 * auto-fit/auto-fill minimum track size.
 */
export type GridProps<E extends ElementType = 'div'> = Omit<BoxProps<E>, 'display'> & {
    columns?: GridColumns;
    /** Min track size for auto-fit/auto-fill (e.g. '180px', '12rem'). Defaults to 180px. */
    minColumnWidth?: string;
};

const columnsClass: Record<string, string> = {
    '2': 'grid-cols-2',
    '3': 'grid-cols-3',
    '4': 'grid-cols-4',
    'auto-fit': 'grid-auto-fit',
    'auto-fill': 'grid-auto-fill'
};

const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
    { columns, minColumnWidth, className, style, ...props },
    ref
) {
    const colClass = columns !== undefined ? columnsClass[String(columns)] : undefined;
    const mergedStyle = minColumnWidth
        ? ({ ...(style as CSSProperties), '--grid-min': minColumnWidth } as CSSProperties)
        : style;

    return (
        <Box
            ref={ref as Ref<Element>}
            display='grid'
            className={[colClass, className].filter(Boolean).join(' ') || undefined}
            style={mergedStyle}
            {...(props as BoxProps)}
        />
    );
}) as <E extends ElementType = 'div'>(props: GridProps<E> & { ref?: Ref<HTMLElement> }) => ReactElement;

export default Grid;
