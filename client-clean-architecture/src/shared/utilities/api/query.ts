type Primitive = string | number | boolean | null | undefined | Date;
type QueryValue = Primitive | Primitive[] | Record<string, any>;

export const objectToSearchParams = (
    obj: Record<string, QueryValue> | undefined,
    opts?: { arrayFormat?: 'repeat' | 'comma'; nested?: 'brackets' | 'dot' }
): URLSearchParams => {
    const searchParams = new URLSearchParams();
    if (!obj) return searchParams;

    const arrayFormat = opts?.arrayFormat ?? 'repeat';
    const nested = opts?.nested ?? 'brackets';

    const add = (key: string, value: any) => {
        if (value === undefined || value === null) return;

        if (value instanceof Date) {
            searchParams.append(key, value.toISOString());
            return;
        }

        if (Array.isArray(value)) {
            if (arrayFormat === 'comma') {
                const v = value
                    .filter((x) => x !== undefined && x !== null)
                    .map((x) => (x instanceof Date ? x.toISOString() : String(x)))
                    .join(',');
                if (v) searchParams.append(key, v);
            } else {
                for (const item of value) {
                    add(key, item);
                }
            }
            return;
        }

        if (typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                const nextKey = nested === 'dot' ? `${key}.${k}` : `${key}[${k}]`;
                add(nextKey, v);
            }
            return;
        }

        searchParams.append(key, String(value));
    };

    for (const [k, v] of Object.entries(obj)) {
        add(k, v);
    }

    return searchParams;
};

export const appendSearchParams = (url: string, params?: URLSearchParams) => {
    if (!params) return url;

    const queryString = params.toString();
    if (!queryString) return url;

    return url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`;
};
