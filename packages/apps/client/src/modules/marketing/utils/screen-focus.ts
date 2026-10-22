// A screen is a picture in the page, but the app in it still focuses elements as it does in
// the app (the AI page's spreadsheet focuses its first cell when it opens), and focusing an
// element scrolls every page around it to bring it into view, the landing's included. In a
// screen, elements take focus without scrolling anything.
const focusWithoutScroll = (prototype: HTMLOrSVGElement) => {
    const focus = prototype.focus;
    prototype.focus = function (this: HTMLOrSVGElement, options?: FocusOptions) {
        focus.call(this, { ...options, preventScroll: true });
    };
};

export const isolateScreenFocus = (): void => {
    focusWithoutScroll(HTMLElement.prototype);
    focusWithoutScroll(SVGElement.prototype);
};
