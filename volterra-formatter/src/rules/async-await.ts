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

export function formatAsyncAwait(code: string): string {
    let result = code;

    // async function name () -> async function name()
    // Use [ \t]+ to avoid consuming newlines
    result = result.replace(/\basync[ \t]+function[ \t]+(\w+)[ \t]*\(/g, 'async function $1(');

    // async function name() { -> async function name(){
    result = result.replace(/(async[ \t]+function[ \t]+\w+\([^)]*\))[ \t]+\{/g, '$1{');
    result = result.replace(/(async[ \t]+function[ \t]+\w+\([^)]*\))[ \t]*\n[ \t]*\{/g, '$1{');

    // async methodName( in class - only on same line
    // Use [ \t]+ instead of \s+ to not merge lines
    result = result.replace(/\basync[ \t]+(\w+)[ \t]*\(/g, 'async $1(');

    // "for await(" must become "for await (" because forawait is invalid
    // First, normalize any incorrect spacing
    result = result.replace(/\bfor[ \t]+await[ \t]*\(/g, 'for await (');
    // Ensure no space before for
    result = result.replace(/\bfor[ \t]+await/g, 'for await');

    return result;
}
