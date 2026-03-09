export interface JsonRequestOptions {
    method: 'POST';
    body: object;
};

interface JsonEnvelope {
    data: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const postJson = async (url: string, options: JsonRequestOptions): Promise<JsonEnvelope> => {
    const response = await fetch(url, {
        method: options.method,
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify(options.body)
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        if (isRecord(payload) && typeof payload.message === 'string') {
            message = payload.message;
        }

        throw new Error(message);
    }

    if (!isRecord(payload) || !('data' in payload)) {
        throw new Error('Unexpected response payload');
    }

    return {
        data: payload.data
    };
};
