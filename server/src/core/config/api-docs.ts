import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

const OPENAPI_SPEC_PATH = join(__dirname, '../docs/openapi.yaml');

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
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;

let specCache: string | null = null;

const loadSpec = (): string => {
    if (process.env.NODE_ENV === 'production' && specCache) {
        return specCache;
    }

    specCache = readFileSync(OPENAPI_SPEC_PATH, 'utf-8');
    return specCache;
};

router.get('/openapi.yaml', (_req, res) => {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.send(loadSpec());
});

router.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(REDOC_HTML);
});

export default router;
