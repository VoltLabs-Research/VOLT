import Box from '../Box';
import { forwardRef } from 'react';
import type { BoxProps } from '../Box';
import type { ElementType, ReactElement, Ref } from 'react';

/**
 * Horizontal flex row. Defaults to `d-flex items-center`.
 * Accepts every `Box` style prop plus `reverse`.
 */
export type RowProps<E extends ElementType = 'div'> = Omit<BoxProps<E>, 'display' | 'direction'> & {
    reverse?: boolean;
};

const Row = forwardRef<HTMLElement, RowProps>(function Row({ reverse, align = 'center', ...props }, ref) {
    return (
        <Box
            ref={ref as Ref<Element>}
            display='flex'
            direction={reverse ? 'row-reverse' : 'row'}
            align={align}
            {...(props as BoxProps)}
        />
    );
}) as <E extends ElementType = 'div'>(props: RowProps<E> & { ref?: Ref<HTMLElement> }) => ReactElement;

export default Row;
