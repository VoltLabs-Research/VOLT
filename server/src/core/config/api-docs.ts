import { Router } from 'express';
import { access, readFile } from 'node:fs/promises';
import { join } from 'path';
import helmet from 'helmet';

const router = Router();

const OPENAPI_SPEC_CANDIDATES = [
    join(__dirname, '../docs/openapi.yaml'),
    join(__dirname, '../../../core/docs/openapi.yaml')
];

const REDOC_CDN = 'https://cdn.redoc.ly';
const docsHelmet = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", REDOC_CDN, "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            workerSrc: ["'self'", 'blob:'],
            fontSrc: ["'self'", 'data:', REDOC_CDN],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: null
        }
    },
    crossOriginResourcePolicy: false
});

const REDOC_HTML = `<!DOCTYPE html>
<html>
<head>
    <title>Volt API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body { margin: 0; padding: 0; }</style>
</head>
<body>
    <redoc spec-url="/api-docs/openapi.yaml"
        hide-hostname
        expand-responses="200"
        path-in-middle-panel
        theme='{
            "colors": { "primary": { "main": "#6366f1" } },
            "typography": { "fontFamily": "system-ui, -apple-system, sans-serif", "headings": { "fontFamily": "system-ui, -apple-system, sans-serif" } },
            "sidebar": { "width": "280px", "backgroundColor": "#fafafa" }
        }'
    ></redoc>
    <script src="${REDOC_CDN}/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;

let specCache: string | null = null;

const resolveSpecPath = async (): Promise<string> => {
    for (const candidate of OPENAPI_SPEC_CANDIDATES) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next candidate path.
        }
    }

    throw new Error(`OpenAPI spec not found. Checked: ${OPENAPI_SPEC_CANDIDATES.join(', ')}`);
};

const loadSpec = async (): Promise<string> => {
    if (process.env.NODE_ENV === 'production' && specCache) {
        return specCache;
    }

    const specPath = await resolveSpecPath();
    specCache = await readFile(specPath, 'utf-8');
    return specCache;
};

router.get('/openapi.yaml', async (_req, res, next) => {
    try {
        const spec = await loadSpec();
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.send(spec);
    } catch (error) {
        next(error);
    }
});

router.get('/', docsHelmet, (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(REDOC_HTML);
});

export default router;
