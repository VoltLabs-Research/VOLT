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

import type { Artifact } from '@/services/plugins/artifact-processor';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface EntrypointArg {
    type: 'enum' | 'number';
    default: string | number;
    values?: string[];
};

interface Entrypoint{
    bin: string;
    args: Record<string, EntrypointArg>;
};

export interface Manifest{
    name: string;
    version: string;
    artifacts: Artifact[];
    entrypoint: Entrypoint;
};

export default class ManifestService{
    private manifestCache: Manifest | null = null;

    constructor(
        private pluginsDir: string,
        private pluginName: string
    ){}

    async get(): Promise<Manifest>{
        if(this.manifestCache) return this.manifestCache;

        const p = path.join(this.pluginsDir, this.pluginName, 'manifest.json');
        const data = await fs.readFile(p, 'utf-8');
        this.manifestCache = JSON.parse(data) as Manifest;
        return this.manifestCache;
    }
};