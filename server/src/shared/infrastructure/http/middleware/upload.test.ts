import 'reflect-metadata';
import { ErrorCodes } from '@core/constants/error-codes';
import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { uploadTrajectoryFiles } from './upload';

interface ErrorResponseBody {
    code: string;
    message: string;
    status: 'error';
    statusCode: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isErrorResponseBody = (value: unknown): value is ErrorResponseBody => {
    if (!isRecord(value)) {
        return false;
    }

    return value.status === 'error'
        && typeof value.code === 'string'
        && typeof value.message === 'string'
        && typeof value.statusCode === 'number';
};

const requestUpload = async (files: Array<{ filename: string; contents: string }>) => {
    const app = express();

    app.post('/upload', uploadTrajectoryFiles('trajectoryFiles'), (_request, response) => {
        response.status(200).json({ status: 'success' });
    });

    const server = app.listen(0);

    try {
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Server address not available');
        }

        const formData = new FormData();
        for (const file of files) {
            formData.append(
                'trajectoryFiles',
                new Blob([file.contents], { type: 'application/octet-stream' }),
                file.filename
            );
        }

        const response = await fetch(`http://127.0.0.1:${address.port}/upload`, {
            method: 'POST',
            body: formData
        });

        return {
            body: await response.json(),
            status: response.status
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
};

test('uploadTrajectoryFiles: returns a clear error when file count exceeds the limit', async () => {
    const files = Array.from({ length: 201 }, (_, index) => ({
        contents: `frame-${index}`,
        filename: `frame-${index}.dump`
    }));

    const response = await requestUpload(files);
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 400);
    assert.equal(body.code, ErrorCodes.TRAJECTORY_UPLOAD_FILE_LIMIT_EXCEEDED);
    assert.equal(body.message, 'Trajectory upload supports up to 200 files per request.');
    assert.equal(body.statusCode, 400);
});
