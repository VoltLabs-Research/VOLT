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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export default class ManifestResolver{
    private cache = new Map<string, any>();

    constructor(
        private baseDir: string
    ){}

    async load(manifestPath: string): Promise<any>{
        const fullPath = path.join(this.baseDir, manifestPath);
        return await this.resolveFile(fullPath);
    }

    private async resolveFile(filePath: string): Promise<any>{
        if(this.cache.has(filePath)){
            return this.cache.get(filePath);
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const rawObj = JSON.parse(content);
        const resolvedObj = await this.processNode(rawObj, filePath);

        this.cache.set(filePath, resolvedObj);
        return resolvedObj;
    }

    private async processNode(node: any, currentFilePath: string): Promise<any>{
        // If it is null or not an object, return as is (primitive base case)
        if(node === null || typeof node !== 'object'){
            return node;
        }

        // Is it a reference?
        if('$ref' in node && typeof node.$ref === 'string'){
            const refPath = this.resolveRefPath(currentFilePath, node.$ref);
            return await this.resolveFile(refPath);
        }

        // If it's an array, process each element recursively.
        if(Array.isArray(node)){
            return Promise.all(node.map((item) => this.processNode(item, currentFilePath)));
        }

        // If it is a standard object, process its properties recursively.
        const resolved: any = {};
        const entries = Object.entries(node);
        
        const resolvedEntries = await Promise.all(entries.map((async ([key, value]) => {
            return [key, await this.processNode(value, currentFilePath)];
        })));

        for(const [key, value] of resolvedEntries){
            resolved[key] = value;
        }
        
        return resolved;
    }

    private resolveRefPath(currentPath: string, ref: string): string{
        const currentDir = path.dirname(currentPath);
        return path.resolve(currentDir, ref);
    }

    clearCache(): void{
        this.cache.clear();
    }
};