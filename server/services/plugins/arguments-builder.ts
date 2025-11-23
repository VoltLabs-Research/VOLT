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

import { EntrypointArgument } from '@/types/services/plugin';

export default class ArgumentsBuilder {
    constructor(
        private argDefs: Record<string, EntrypointArgument>
    ) { }

    async isValidArg(arg: string, value: string): Promise<boolean> {
        const def = this.argDefs[arg];
        if (!def) return false;

        if (def.type === 'select') {
            const values = def.values;
            if (Array.isArray(values)) {
                if (!values.length) return false;
                return values.includes(value);
            }

            if (values && typeof values === 'object') {
                return Object.prototype.hasOwnProperty.call(values, value);
            }

            return false;
        }

        if (def.type === 'number') return !Number.isNaN(Number(value));

        if (def.type === 'boolean') {
            const v = String(value).toLowerCase();
            return v === 'true' || v === 'false' || v === '1' || v === '0';
        }

        if (def.type === 'trajectory-frame') {
            // It can be a number (timestep) or a string (path, if already resolved)
            // We'll accept anything non-empty
            return value !== undefined && value !== null && String(value).trim() !== '';
        }

        return true;
    }

    async build(options: any): Promise<string[]> {
        const args: string[] = [];

        for (const argKey in this.argDefs) {
            const hasValue = Object.prototype.hasOwnProperty.call(options, argKey);
            const rawValue = hasValue ? options[argKey] : this.argDefs[argKey].default;
            if (rawValue === undefined || rawValue === null) continue;

            const value = rawValue as string;
            if (!(await this.isValidArg(argKey, value))) continue;

            // TODO: Check this!
            if (this.argDefs[argKey].type === 'boolean') {
                const normalized = typeof value === 'boolean'
                    ? value
                    : ['true', '1'].includes(String(value).toLowerCase());
                args.push(`--${argKey}`, normalized ? 'true' : 'false');
            } else {
                args.push(`--${argKey}`, String(value));
            }
        }

        return args;
    }
};