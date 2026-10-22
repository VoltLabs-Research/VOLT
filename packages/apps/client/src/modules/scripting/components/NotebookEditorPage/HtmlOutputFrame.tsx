import { useEffect, useId, useMemo, useState } from 'react';

interface HtmlOutputFrameProps {
    html: string;
}

const MIN_HEIGHT = 24;
const MAX_HEIGHT = 4_000;

const themeValue = (name: string, fallback: string): string => (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
);

// HTML a cell displayed (a DataFrame's table, a widget's markup) in a document of its own: its
// scripts run in an opaque origin, apart from the app's. The document reports its height to the
// frame from its head, which markup the cell left unclosed cannot swallow.
const frameDocument = (html: string, frameId: string): string => {
    const foreground = themeValue('--foreground', '#28282b');
    const muted = themeValue('--muted', '#5e5e61');
    const border = themeValue('--border', '#e4e4e7');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{color-scheme:light dark}
html,body{margin:0;background:transparent;color:${foreground};font:13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
table{border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid ${border};padding:4px 10px;text-align:right;white-space:nowrap}
thead th{color:${muted};font-weight:500}
tbody tr:hover{background:color-mix(in srgb,${foreground} 5%,transparent)}
</style><script>
const report = () => parent.postMessage({ voltOutputFrame: ${JSON.stringify(frameId)}, height: document.documentElement.scrollHeight }, '*');
new ResizeObserver(report).observe(document.documentElement);
addEventListener('load', report);
</script></head><body>${html}</body></html>`;
};

const HtmlOutputFrame = ({ html }: HtmlOutputFrameProps) => {
    const frameId = useId();
    const [height, setHeight] = useState(MIN_HEIGHT);
    const srcDoc = useMemo(() => frameDocument(html, frameId), [html, frameId]);

    useEffect(() => {
        const listener = (event: MessageEvent<{ voltOutputFrame?: string; height?: unknown }>) => {
            if(event.data?.voltOutputFrame === frameId && typeof event.data.height === 'number'){
                setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(event.data.height))));
            }
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [frameId]);

    return (
        <iframe
            title='Cell output'
            sandbox='allow-scripts allow-popups'
            srcDoc={srcDoc}
            className='block w-full border-0'
            style={{ height }}
        />
    );
};

export default HtmlOutputFrame;
