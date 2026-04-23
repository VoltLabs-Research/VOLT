import type {
    Display,
    FlexDirection,
    AlignItems,
    JustifyContent,
    GapToken,
    PaddingToken,
    PaddingXToken,
    MarginTopToken,
    MarginBottomToken,
    MarginXToken,
    RadiusToken,
    BorderToken,
    PositionToken,
    OverflowToken,
    WidthToken,
    HeightToken,
    FlexToken,
    TransitionToken,
    TextAlign
} from './types';

/**
 * Style-related props shared by all box-like primitives: `Box`, `Stack`, `Row`,
 * `Surface`, `Card`, `Alert`, etc.
 *
 * Every value maps to an existing CSS utility class. Unknown values are never
 * emitted so we don't produce dead classnames.
 */
export interface BoxStyleProps {
    display?: Display;
    direction?: FlexDirection;
    align?: AlignItems;
    justify?: JustifyContent;
    wrap?: boolean;
    gap?: GapToken;

    p?: PaddingToken;
    px?: PaddingXToken;

    m?: '0';
    mt?: MarginTopToken;
    mb?: MarginBottomToken;
    mx?: MarginXToken;

    radius?: RadiusToken;
    border?: BorderToken;
    position?: PositionToken;
    overflow?: OverflowToken;

    width?: WidthToken;
    height?: HeightToken;
    flex?: FlexToken;

    textAlign?: TextAlign;

    shrink?: '0';
    minH?: '0';
    minW?: '0';

    inset?: '0';
    top?: '0' | '1';
    left?: '0' | '1';
    bottom?: '0' | '1';
    right?: '0' | '1';

    zIndex?: '5' | '10' | '20';

    transition?: TransitionToken;
    cursor?: 'pointer';
    selectNone?: boolean;
}

const alignMap: Record<AlignItems, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end'
};

const justifyMap: Record<JustifyContent, string> = {
    start: '',
    center: 'content-center',
    end: 'content-end',
    between: 'content-between',
    around: 'content-around'
};

const displayMap: Record<Display, string> = {
    flex: 'd-flex',
    block: 'd-block',
    none: 'd-none'
};

const directionMap: Record<FlexDirection, string> = {
    row: '',
    column: 'column',
    'row-reverse': 'row-reverse'
};

const textAlignMap: Record<TextAlign, string> = {
    left: '',
    center: 'text-center',
    right: ''
};

const borderMap: Record<BorderToken, string> = {
    soft: 'b-soft',
    none: 'b-none',
    'bottom-soft': 'border-bottom-soft',
    'top-soft': 'border-top-soft'
};

const widthMap: Record<WidthToken, string> = {
    max: 'w-max',
    '50': 'w-50',
    'vw-max': 'wh-max'
};

const heightMap: Record<HeightToken, string> = {
    max: 'h-max',
    'vh-max': 'vh-max'
};

export const buildBoxClasses = (props: BoxStyleProps): string[] => {
    const classes: string[] = [];

    if (props.display) classes.push(displayMap[props.display]);
    if (props.direction) {
        const directionClass = directionMap[props.direction];
        if (directionClass) classes.push(directionClass);
    }
    if (props.align) classes.push(alignMap[props.align]);
    if (props.justify) {
        const justifyClass = justifyMap[props.justify];
        if (justifyClass) classes.push(justifyClass);
    }
    if (props.wrap) classes.push('flex-wrap');
    if (props.gap) classes.push(`gap-${props.gap}`);

    if (props.p !== undefined) classes.push(`p-${props.p}`);
    if (props.px) classes.push(`px-${props.px}`);

    if (props.m !== undefined) classes.push(`m-${props.m}`);
    if (props.mt) classes.push(`mt-${props.mt}`);
    if (props.mb) classes.push(`mb-${props.mb}`);
    if (props.mx) classes.push(`mx-${props.mx}`);

    if (props.radius) classes.push(`radius-${props.radius}`);
    if (props.border) classes.push(borderMap[props.border]);
    if (props.position) classes.push(`p-${props.position}`);
    if (props.overflow) classes.push(`${props.overflow}`.includes('-') ? props.overflow : `overflow-${props.overflow}`);

    if (props.width) classes.push(widthMap[props.width]);
    if (props.height) classes.push(heightMap[props.height]);
    if (props.flex) classes.push(`flex-${props.flex}`);

    if (props.textAlign) {
        const taClass = textAlignMap[props.textAlign];
        if (taClass) classes.push(taClass);
    }

    if (props.shrink === '0') classes.push('f-shrink-0');
    if (props.minH === '0') classes.push('min-h-0');
    if (props.minW === '0') classes.push('min-w-0');

    if (props.inset === '0') classes.push('inset-0');
    if (props.top !== undefined) classes.push(`top-${props.top}`);
    if (props.left !== undefined) classes.push(`left-${props.left}`);
    if (props.bottom !== undefined) classes.push(`bottom-${props.bottom}`);
    if (props.right !== undefined) classes.push(`right-${props.right}`);

    if (props.zIndex) classes.push(`z-${props.zIndex}`);

    if (props.transition) classes.push(`transition-${props.transition}`);
    if (props.cursor === 'pointer') classes.push('cursor-pointer');
    if (props.selectNone) classes.push('u-select-none');

    return classes;
};

/**
 * Keys of `BoxStyleProps`. Used by primitives to strip style-only props
 * from the rest passed through to the DOM element.
 */
export const BOX_STYLE_KEYS = [
    'display', 'direction', 'align', 'justify', 'wrap', 'gap',
    'p', 'px', 'm', 'mt', 'mb', 'mx',
    'radius', 'border', 'position', 'overflow',
    'width', 'height', 'flex',
    'textAlign',
    'shrink', 'minH', 'minW',
    'inset', 'top', 'left', 'bottom', 'right',
    'zIndex',
    'transition', 'cursor', 'selectNone'
] as const;

export const splitBoxProps = <T extends BoxStyleProps>(props: T): {
    styleProps: BoxStyleProps;
    rest: Omit<T, keyof BoxStyleProps>;
} => {
    const styleProps: Record<string, unknown> = {};
    const rest: Record<string, unknown> = {};

    for (const key of Object.keys(props)) {
        if ((BOX_STYLE_KEYS as readonly string[]).includes(key)) {
            styleProps[key] = (props as Record<string, unknown>)[key];
        } else {
            rest[key] = (props as Record<string, unknown>)[key];
        }
    }

    return {
        styleProps: styleProps as BoxStyleProps,
        rest: rest as Omit<T, keyof BoxStyleProps>
    };
};
