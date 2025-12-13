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

export function formatChaining(code: string): string {
    const lines = code.split('\n');
    const result: string[] = [];

    for(let i = 0; i < lines.length; i++){
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this line starts with a chained method call
        if(trimmed.startsWith('.')){
            // Look back to find the base indent
            const baseIndent = findChainBaseIndent(lines, i);
            if(baseIndent !== null){
                // Apply 4 spaces more than the base
                const newIndent = ' '.repeat(baseIndent + 4);
                result.push(newIndent + trimmed);
                continue;
            }
        }

        result.push(line);
    }

    return result.join('\n');
}

/**
 * Find the indent level of the assignment that started this chain
 */
function findChainBaseIndent(lines: string[], currentIndex: number): number | null {
    // Walk backwards to find the start of the chain
    for(let i = currentIndex - 1; i >= 0; i--){
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if(trimmed === ''){
            continue;
        }

        // If this line also starts with ., keep looking
        if(trimmed.startsWith('.')){
            continue;
        }

        // Found the start of the chain - return its indent
        const indent = line.length - line.trimStart().length;
        return indent;
    }

    return null;
}
