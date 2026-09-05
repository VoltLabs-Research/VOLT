import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';

const ENDPOINT_BOOTSTRAP_TAG = '<script>window.__VOLT_SERVER_ENDPOINT__=window.location.origin;</script>';
const NAV_BRIDGE_TAG = '<script src="/__nav-bridge.js"></script>';
const NON_CLIENT_PREFIXES = ['/api/', '/socket.io/', '/healthz'];

const BOOTSTRAP_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Volt</title></head>
<body><script>
(function(){
  try{
    var token = new URLSearchParams(location.search).get('token');
    if(token){ localStorage.setItem('authToken', token); }
  }catch(e){}
  location.replace('/');
})();
</script></body></html>
`;

const NAV_BRIDGE_SCRIPT = `(function(){
  function send(){
    try{
      parent.postMessage({ source: 'volt-client', path: location.pathname + location.search + location.hash }, '*');
    }catch(e){}
  }
  ['pushState', 'replaceState'].forEach(function(name){
    var original = history[name];
    history[name] = function(){
      var result = original.apply(this, arguments);
      send();
      return result;
    };
  });
  window.addEventListener('popstate', send);
  window.addEventListener('message', function(event){
    var data = event.data;
    if(!data || data.source !== 'volt-shell') return;
    if(data.action === 'go' && typeof data.path === 'string'){
      var state = history.state;
      var idx = (state && typeof state.idx === 'number') ? state.idx + 1 : 1;
      var key = Math.random().toString(36).slice(2, 10);
      history.pushState({ usr: null, key: key, idx: idx }, '', data.path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }else if(data.action === 'back'){
      history.back();
    }else if(data.action === 'forward'){
      history.forward();
    }
  });
  if(document.readyState !== 'loading') send();
  else window.addEventListener('DOMContentLoaded', send);
})();
`;

const relaxDocumentSecurityHeaders = (res: Response): void => {
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
};

const isClientNavigation = (req: Request): boolean =>
    req.method === 'GET'
    && !NON_CLIENT_PREFIXES.some((prefix) => req.path.startsWith(prefix))
    && req.accepts(['html', 'json']) === 'html';

export const resolveClientDistDir = (): string | null => {
    const configured = process.env.CLIENT_DIST_DIR?.trim();
    return configured ? path.resolve(configured) : null;
};

export const mountShellBridge = (app: Express): void => {
    app.get('/__bootstrap.html', (_req: Request, res: Response) => {
        relaxDocumentSecurityHeaders(res);
        res.setHeader('Cache-Control', 'no-store');
        res.type('html').send(BOOTSTRAP_PAGE);
    });

    app.get('/__nav-bridge.js', (_req: Request, res: Response) => {
        res.type('application/javascript').send(NAV_BRIDGE_SCRIPT);
    });
};

export const mountClientApp = (app: Express, distDir: string): void => {
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')
        .replace('<head>', `<head>${ENDPOINT_BOOTSTRAP_TAG}`)
        .replace('</body>', `${NAV_BRIDGE_TAG}</body>`);

    const sendIndex = (res: Response): void => {
        relaxDocumentSecurityHeaders(res);
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(indexHtml);
    };

    app.use(express.static(distDir, {
        index: false,
        setHeaders: relaxDocumentSecurityHeaders
    }));

    app.use((req: Request, res: Response, next: NextFunction) => {
        if (!isClientNavigation(req)) {
            next();
            return;
        }

        sendIndex(res);
    });
};
