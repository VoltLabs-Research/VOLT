import { cn } from '@/shared/utils/cn';
import { buildBoxClasses, splitBoxProps } from '../buildBoxClasses';
import { forwardRef } from 'react';
import type { BoxStyleProps } from '../buildBoxClasses';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';

type PolymorphicProps<E extends ElementType> = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    as?: E;
    children?: ReactNode;
    className?: string;
};

export type BoxProps<E extends ElementType = 'div'> = PolymorphicProps<E> & BoxStyleProps;

const BoxImpl = <E extends ElementType = 'div'>(
    { as, className, children, ...props }: BoxProps<E>,
    ref: Ref<Element>
) => {
    const Component = (as ?? 'div') as ElementType;
    const { styleProps, rest } = splitBoxProps(props);
    const classes = cn(...buildBoxClasses(styleProps), className);

    return (
        <Component ref={ref} className={classes} {...rest}>
            {children}
        </Component>
    );
};

const Box = forwardRef(BoxImpl) as <E extends ElementType = 'div'>(
    props: BoxProps<E> & { ref?: Ref<Element> }
) => ReturnType<typeof BoxImpl>;

export default Box;
