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

import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import { relative } from 'path';
import { formatCode } from './formatter';

interface FormatOptions{
    check?: boolean;
    write?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
};

// parallel batches
const BATCH_SIZE = 50;

const processFile = async (file: string, options: FormatOptions): Promise<{ file: string, changed: boolen }> => {
    const content = await fs.readFile(file, 'utf-8');
    const formatted = formatCode(content);
    const changed = content !== formatted;

    if(changed && options.write){
        await fs.writeFile(file, formatted, 'utf-8');
    }

    return { file, changed };
};

const run = async (args: string[]): Promise<void> => {
    const startTime = performance.now();

    const options: FormatOptions = {
        check: args.includes('--check'),
        write: !args.includes('--check') && !args.includes('--dry-run'),
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose') || args.includes('-v')
    };

    const patterns = args.filter((arg) => !arg.startsWith('-'));
    if(patterns.length === 0){
        console.log('Usage: volterra-format [options] <files...>\n');
        console.log('Options:');
        console.log('  --check     Check formatting without modifying files');
        console.log('  --dry-run   Show formatted output without writing');
        console.log('  --verbose   Show detailed output');
        return;
    }

    let files: string[] = [];
    for(const pattern of patterns){
        if(pattern.includes('*')){
            // glob pattern
            const matches = await glob(pattern,  {
                absolute: true,
                nodir: true,
                ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
            });
            files.push(...matches);
        }else{
            // direct file path
            files.push(pattern);
        }
    }

    files = [...new Set(files)];
    if(files.length === 0){
        console.log('No files matched the given patterns.');
        return;
    }

    // process all files in parallel batches
    let changed = 0;
    const results: { file: string, changed: boolean }[] = [];
    for(let i = 0; i < files.length; i += BATCH_SIZE){
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map((file => processFile(file, options))));
        results.push(...batchResults);
    }

    for(const result of results){
        if(result.changed){
            changed++;
            if(options.verbose || options.check){
                const prefix = options.check ? 'FAILED' : 'OK';
                console.log(`${prefix} ${relative(process.cwd(), result.file)}`);
            }
        }else if(options.verbose){
            console.log(`${relative(process.cwd(), result.file)} (unchanged)`);
        }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\nProcessed ${files.length} file(s), ${changed} changed in ${elapsed}s`);

    if(options.check && changed > 0){
        process.exit(1);
    }
};

run(process.argv.slice(2));