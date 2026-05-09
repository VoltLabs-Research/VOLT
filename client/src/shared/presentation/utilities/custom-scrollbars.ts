const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);
const DEFAULT_SCROLLBAR_SIZE = 6;
const DEFAULT_THUMB_LENGTH = 28;
const DEFAULT_EDGE_OFFSET = 2;
const MIN_SCROLL_DISTANCE = 1;

type ScrollAxis = 'horizontal' | 'vertical';

type ScrollbarConfig = {
    edgeOffset: number;
    size: number;
    thumbLength: number;
};

type ScrollbarAxisState = {
    isScrollable: boolean;
    maxScroll: number;
};

let activeScrollable: HTMLElement | null = null;
let horizontalThumb: HTMLDivElement | null = null;
let verticalThumb: HTMLDivElement | null = null;
let animationFrame = 0;
let isInitialized = false;

const readPixelVariable = (name: string, fallback: number) => {
    const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const parsedValue = Number.parseFloat(rawValue);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const readScrollbarConfig = (): ScrollbarConfig => ({
    edgeOffset: readPixelVariable('--scrollbar-edge-offset', DEFAULT_EDGE_OFFSET),
    size: readPixelVariable('--scrollbar-size', DEFAULT_SCROLLBAR_SIZE),
    thumbLength: readPixelVariable('--scrollbar-thumb-length', DEFAULT_THUMB_LENGTH)
});

const isOverflowScrollable = (value: string) => SCROLLABLE_OVERFLOW_VALUES.has(value);

const getHTMLElementFromTarget = (target: EventTarget | null) => {
    if (target instanceof HTMLElement) {
        return target;
    }

    if (target instanceof Element) {
        return target.parentElement;
    }

    return null;
};

const getAxisState = (element: HTMLElement, axis: ScrollAxis): ScrollbarAxisState => {
    const computedStyle = window.getComputedStyle(element);
    const overflow = axis === 'vertical' ? computedStyle.overflowY : computedStyle.overflowX;

    if (!isOverflowScrollable(overflow)) {
        return { isScrollable: false, maxScroll: 0 };
    }

    const maxScroll = axis === 'vertical'
        ? element.scrollHeight - element.clientHeight
        : element.scrollWidth - element.clientWidth;

    return {
        isScrollable: maxScroll > MIN_SCROLL_DISTANCE,
        maxScroll
    };
};

const findScrollableElement = (target: EventTarget | null) => {
    let currentElement = getHTMLElementFromTarget(target);

    while (currentElement) {
        if (
            !currentElement.classList.contains('scrollbar-none')
            && (getAxisState(currentElement, 'vertical').isScrollable || getAxisState(currentElement, 'horizontal').isScrollable)
        ) {
            return currentElement;
        }

        currentElement = currentElement.parentElement;
    }

    return null;
};

const getElementRect = (element: HTMLElement) => {
    if (element === document.documentElement || element === document.body) {
        return {
            bottom: window.innerHeight,
            height: window.innerHeight,
            left: 0,
            right: window.innerWidth,
            top: 0,
            width: window.innerWidth
        };
    }

    return element.getBoundingClientRect();
};

const setThumbVisibility = (thumb: HTMLDivElement | null, isVisible: boolean) => {
    thumb?.classList.toggle('is-visible', isVisible);
};

const placeVerticalThumb = (element: HTMLElement, config: ScrollbarConfig, axisState: ScrollbarAxisState) => {
    if (!verticalThumb) {
        return;
    }

    const rect = getElementRect(element);
    const thumbLength = Math.min(config.thumbLength, Math.max(0, rect.height - config.edgeOffset * 2));

    if (!axisState.isScrollable || thumbLength <= 0 || rect.width <= 0 || rect.height <= 0) {
        setThumbVisibility(verticalThumb, false);
        return;
    }

    const travelDistance = Math.max(0, rect.height - config.edgeOffset * 2 - thumbLength);
    const scrollRatio = axisState.maxScroll > 0 ? element.scrollTop / axisState.maxScroll : 0;
    const x = rect.right - config.edgeOffset - config.size;
    const y = rect.top + config.edgeOffset + travelDistance * scrollRatio;

    verticalThumb.style.width = `${config.size}px`;
    verticalThumb.style.height = `${thumbLength}px`;
    verticalThumb.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    setThumbVisibility(verticalThumb, true);
};

const placeHorizontalThumb = (element: HTMLElement, config: ScrollbarConfig, axisState: ScrollbarAxisState) => {
    if (!horizontalThumb) {
        return;
    }

    const rect = getElementRect(element);
    const thumbLength = Math.min(config.thumbLength, Math.max(0, rect.width - config.edgeOffset * 2));

    if (!axisState.isScrollable || thumbLength <= 0 || rect.width <= 0 || rect.height <= 0) {
        setThumbVisibility(horizontalThumb, false);
        return;
    }

    const travelDistance = Math.max(0, rect.width - config.edgeOffset * 2 - thumbLength);
    const scrollRatio = axisState.maxScroll > 0 ? element.scrollLeft / axisState.maxScroll : 0;
    const x = rect.left + config.edgeOffset + travelDistance * scrollRatio;
    const y = rect.bottom - config.edgeOffset - config.size;

    horizontalThumb.style.width = `${thumbLength}px`;
    horizontalThumb.style.height = `${config.size}px`;
    horizontalThumb.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    setThumbVisibility(horizontalThumb, true);
};

const hideScrollbars = () => {
    activeScrollable = null;
    setThumbVisibility(verticalThumb, false);
    setThumbVisibility(horizontalThumb, false);
};

const updateScrollbars = () => {
    animationFrame = 0;

    if (!activeScrollable || !document.documentElement.contains(activeScrollable)) {
        hideScrollbars();
        return;
    }

    const config = readScrollbarConfig();

    placeVerticalThumb(activeScrollable, config, getAxisState(activeScrollable, 'vertical'));
    placeHorizontalThumb(activeScrollable, config, getAxisState(activeScrollable, 'horizontal'));
};

const requestScrollbarUpdate = () => {
    if (animationFrame) {
        return;
    }

    animationFrame = window.requestAnimationFrame(updateScrollbars);
};

const handlePointerOver = (event: PointerEvent) => {
    const scrollableElement = findScrollableElement(event.target);

    if (!scrollableElement) {
        hideScrollbars();
        return;
    }

    activeScrollable = scrollableElement;
    requestScrollbarUpdate();
};

const handlePointerOut = (event: PointerEvent) => {
    if (!activeScrollable || !(event.target instanceof Node) || !activeScrollable.contains(event.target)) {
        return;
    }

    if (event.relatedTarget instanceof Node && activeScrollable.contains(event.relatedTarget)) {
        return;
    }

    hideScrollbars();
};

const handleScroll = (event: Event) => {
    if (activeScrollable && event.target === activeScrollable) {
        requestScrollbarUpdate();
    }
};

const createThumb = (axis: ScrollAxis) => {
    const thumb = document.createElement('div');

    thumb.className = `volt-custom-scrollbar volt-custom-scrollbar--${axis}`;
    thumb.setAttribute('aria-hidden', 'true');
    document.body.appendChild(thumb);

    return thumb;
};

export const initializeCustomScrollbars = () => {
    if (isInitialized || typeof window === 'undefined') {
        return;
    }

    isInitialized = true;
    verticalThumb = createThumb('vertical');
    horizontalThumb = createThumb('horizontal');

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', requestScrollbarUpdate);
};
