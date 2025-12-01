/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import ManifestResolver from '@/services/plugins/manifest-resolver';
import * as path from 'node:path';
import { Manifest } from '@/types/services/plugin';

export default class ManifestService{
    private manifest: Manifest | null = null;
    private pluginDir: string;
    private resolver: ManifestResolver;

    constructor(pluginName: string, pluginsDir = process.env.PLUGINS_DIR || 'plugins'){
        this.pluginDir = path.join(pluginsDir, pluginName);
        this.resolver = new ManifestResolver(this.pluginDir);
    }

    async get(): Promise<Manifest>{
        if(this.manifest){
            return this.manifest;
        }

        this.manifest = await this.resolver.load('manifest.yml');
        return this.manifest!;
    }

    async reload(): Promise<Manifest>{
        this.manifest = null;
        this.resolver.clearCache();
        return await this.get();
    }

    async validate(): Promise<{ valid: boolean; errors: string[] }>{
        const errors: string[] = [];
        try{
            const manifest = await this.get();

            if(!manifest.name) errors.push('Missing required field: name');
            if(!manifest.version) errors.push('Missing required field: version');

            if(!manifest.modifiers || !Array.isArray(manifest.modifiers)){
                errors.push('Missing or invalid field: modifiers (must be mapping or array)');
            }

            if(!manifest.entrypoint) {
                errors.push('Missing required field: entrypoint');
            }else{
                if(!manifest.entrypoint.bin) errors.push('Missing required field: entrypoint.bin');
                if(!manifest.entrypoint.arguments) errors.push('Missing required field: entrypoint.args');
            }

            return { valid: errors.length === 0, errors };
        }catch(error: any){
            return { valid: false, errors: [error.message || 'Failed to load manifest'] };
        }
    }
};