import Box from '../Box';
import { forwardRef } from 'react';
import type { BoxProps } from '../Box';
import type { ElementType, ReactElement, Ref } from 'react';

/**
 * Vertical flex stack. Defaults to `d-flex column`.
 * Accepts every `Box` style prop.
 */
export type StackProps<E extends ElementType = 'div'> = Omit<BoxProps<E>, 'display' | 'direction'>;

const Stack = forwardRef<HTMLElement, StackProps>(function Stack(props, ref) {
    return (
        <Box
            ref={ref as Ref<Element>}
            display='flex'
            direction='column'
            {...(props as BoxProps)}
        />
    );
}) as <E extends ElementType = 'div'>(props: StackProps<E> & { ref?: Ref<HTMLElement> }) => ReactElement;

export default Stack;
