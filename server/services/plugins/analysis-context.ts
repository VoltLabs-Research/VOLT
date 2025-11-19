/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import type { ExecutionRecorder } from '@/services/plugins/artifact-processor';
import { getMinioClient } from '@/config/minio';

interface UploadedObject{
    bucket: string;
    key: string;
};

export default class AnalysisContext implements ExecutionRecorder{
    private uploadedObjects: UploadedObject[] = [];

    constructor(
        private pluginName: string
    ){}

    async rollback(): Promise<void>{
        await this.cleanupUploadedObjects();
    }

    recordUpload(bucket: string, key: string): void{
        this.uploadedObjects.push({ bucket, key });
    }

    private async cleanupUploadedObjects(){
        const client = getMinioClient();
        await Promise.all(this.uploadedObjects.map(({ bucket, key }) => {
            client.removeObject(bucket, key).catch((err) => {
                console.error(`[${this.pluginName} plugin] failed to delete ${bucket}/${key}:`, err);
            });
        }));

        this.uploadedObjects = [];
    }
}