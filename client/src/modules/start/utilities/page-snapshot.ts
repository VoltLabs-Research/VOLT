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

const removeScripts = (html: string): string => {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '');
};

export const capturePageSnapshot = (): string | null => {
    try {
        const rootAttrs = serializeAttributes(document.documentElement);
        const bodyAttrs = serializeAttributes(document.body);
        const html = `<!DOCTYPE html>
<html ${rootAttrs}>
<head>
<style>
${collectDocumentStyles()}
${SNAPSHOT_STYLES}
</style>
</head>
<body ${bodyAttrs}>${document.body.innerHTML}</body>
</html>`;

        return removeScripts(html);
    } catch {
        return null;
    }
};
