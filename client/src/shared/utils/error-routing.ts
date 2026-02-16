export type ErrorSource = 'render' | 'window' | 'promise';

const ERROR_PATH = '/error';
const MAX_STACK_LENGTH = 2000;

export const buildErrorPath = (
    message: string,
    source: ErrorSource,
    stack?: string
): string => {
    const params = new URLSearchParams();
    params.set('message', message);
    params.set('source', source);
    params.set('t', String(Date.now()));

    if(stack){
        params.set('stack', stack.length > MAX_STACK_LENGTH
            ? stack.slice(0, MAX_STACK_LENGTH)
            : stack
        );
    }

    return `${ERROR_PATH}?${params.toString()}`;
};

export const SOURCE_LABELS: Record<string, string> = {
    render: 'Component render',
    window: 'Runtime exception',
    promise: 'Unhandled promise rejection'
};

const IGNORED_PATTERNS = [
    'ResizeObserver loop',
    'Script error',
    'ERR_CANCELED'
];

export const shouldIgnoreError = (message: string): boolean =>
    IGNORED_PATTERNS.some((p) => message.includes(p));

export const isErrorPage = (pathname: string): boolean =>
    pathname === ERROR_PATH;
