const SNAPSHOT_STYLES = `
* { pointer-events: none !important; cursor: default !important; user-select: none !important; }
::-webkit-scrollbar { display: none !important; }
body { overflow: hidden !important; margin: 0 !important; }
`;

const serializeAttributes = (element: HTMLElement): string => {
    return element.getAttributeNames()
        .filter((name) => name !== 'xmlns')
        .map((name) => `${name}="${(element.getAttribute(name) || '').replace(/"/g, '&quot;')}"`)
        .join(' ');
};

const collectDocumentStyles = (): string => {
    let allCSS = '';

    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                allCSS += `${rule.cssText}\n`;
            }
        } catch {
            continue;
        }
    }

    return allCSS;
};

const mirrorInputState = (live: ParentNode, clone: ParentNode): void => {
    const liveInputs = live.querySelectorAll<HTMLInputElement>('input');
    const cloneInputs = clone.querySelectorAll<HTMLInputElement>('input');
    liveInputs.forEach((liveInput, index) => {
        const cloneInput = cloneInputs[index];
        if (!cloneInput) return;
        if (liveInput.type === 'checkbox' || liveInput.type === 'radio') {
            if (liveInput.checked) cloneInput.setAttribute('checked', '');
            else cloneInput.removeAttribute('checked');
        } else {
            cloneInput.setAttribute('value', liveInput.value);
        }
    });

    const liveTextareas = live.querySelectorAll<HTMLTextAreaElement>('textarea');
    const cloneTextareas = clone.querySelectorAll<HTMLTextAreaElement>('textarea');
    liveTextareas.forEach((liveTextarea, index) => {
        const cloneTextarea = cloneTextareas[index];
        if (cloneTextarea) cloneTextarea.textContent = liveTextarea.value;
    });

    const liveSelects = live.querySelectorAll<HTMLSelectElement>('select');
    const cloneSelects = clone.querySelectorAll<HTMLSelectElement>('select');
    liveSelects.forEach((liveSelect, index) => {
        const cloneSelect = cloneSelects[index];
        if (!cloneSelect) return;
        const liveOptions = liveSelect.querySelectorAll('option');
        const cloneOptions = cloneSelect.querySelectorAll('option');
        liveOptions.forEach((liveOption, optionIndex) => {
            const cloneOption = cloneOptions[optionIndex];
            if (!cloneOption) return;
            if (liveOption.selected) cloneOption.setAttribute('selected', '');
            else cloneOption.removeAttribute('selected');
        });
    });
};

const mirrorCanvasState = (live: ParentNode, clone: ParentNode): void => {
    const liveCanvases = live.querySelectorAll<HTMLCanvasElement>('canvas');
    const cloneCanvases = clone.querySelectorAll<HTMLCanvasElement>('canvas');
    liveCanvases.forEach((liveCanvas, index) => {
        const cloneCanvas = cloneCanvases[index];
        if (!cloneCanvas || !cloneCanvas.parentNode) return;
        try {
            const image = document.createElement('img');
            image.src = liveCanvas.toDataURL();
            for (const attr of Array.from(cloneCanvas.attributes)) {
                image.setAttribute(attr.name, attr.value);
            }
            cloneCanvas.parentNode.replaceChild(image, cloneCanvas);
        } catch {
            return;
        }
    });
};

export const capturePageSnapshot = (): string | null => {
    try {
        const rootAttrs = serializeAttributes(document.documentElement);
        const bodyClone = document.body.cloneNode(true) as HTMLElement;

        mirrorInputState(document.body, bodyClone);
        mirrorCanvasState(document.body, bodyClone);
        bodyClone.querySelectorAll('script').forEach((node) => node.remove());

        const bodyAttrs = serializeAttributes(bodyClone);
        return `<!DOCTYPE html>
<html ${rootAttrs}>
<head>
<style>
${collectDocumentStyles()}
${SNAPSHOT_STYLES}
</style>
</head>
<body ${bodyAttrs}>${bodyClone.innerHTML}</body>
</html>`;
    } catch {
        return null;
    }
};
