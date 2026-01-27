/**
 * Copyright (c) 2025, Volt Authors. All rights reserved.
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

import { formatControlFlow } from './rules/control-flow';
import { formatTryCatch } from './rules/try-catch';
import { formatAsyncAwait } from './rules/async-await';
import { formatChaining } from './rules/chaining';
import { formatDeclarations } from './rules/declarations';

export function formatCode(code: string): string {
    let result = code;

    // Apply formatting rules in order
    result = formatDeclarations(result);
    result = formatControlFlow(result);
    result = formatTryCatch(result);
    result = formatAsyncAwait(result);
    result = formatChaining(result);

    // Final cleanup
    result = cleanupWhitespace(result);

    return result;
}

/**
 * Clean up trailing whitespace and ensure single newline at end
 */
function cleanupWhitespace(code: string): string {
    return code
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd() + '\n';
}
