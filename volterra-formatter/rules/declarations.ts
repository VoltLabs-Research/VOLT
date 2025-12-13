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

export function formatDeclarations(code: string): string {
    let result = code;

    // Regular function declarations
    // function name () -> function name()
    result = result.replace(/\bfunction\s+(\w+)\s*\(/g, 'function $1(');

    // Function body brace
    // function name() { -> function name(){
    result = result.replace(/(function\s+\w+\([^)]*\))\s+\{/g, '$1{');
    result = result.replace(/(function\s+\w+\([^)]*\))\s*\n\s*\{/g, '$1{');

    // Type annotations: function name(): Type {
    result = result.replace(/(function\s+\w+\([^)]*\)\s*:\s*[^{]+)\s+\{/g, '$1{');

    // Class declarations
    // class Name { -> class Name{
    result = result.replace(/\bclass\s+(\w+)\s*\{/g, 'class $1{');
    result = result.replace(/\bclass\s+(\w+)\s*\n\s*\{/g, 'class $1{');

    // Class with extends
    // class Foo extends Bar { -> class Foo extends Bar{
    result = result.replace(/\bclass\s+(\w+)\s+extends\s+(\w+)\s*\{/g, 'class $1 extends $2{');

    // Class with implements
    result = result.replace(/\bclass\s+(\w+)\s+implements\s+([^{]+)\s*\{/g, 'class $1 implements $2{');

    // Export class
    result = result.replace(/\bexport\s+(default\s+)?class\s+(\w+)/g, 'export $1class $2');

    // Constructor
    // constructor () -> constructor()
    result = result.replace(/\bconstructor\s*\(/g, 'constructor(');
    result = result.replace(/(constructor\([^)]*\))\s+\{/g, '$1{');
    result = result.replace(/(constructor\([^)]*\))\s*\n\s*\{/g, '$1{');

    // Methods in classes (async and regular)
    // Method with return type: methodName(args): ReturnType {
    result = result.replace(/(\w+\([^)]*\)\s*:\s*[^{]+)\s+\{/g, '$1{');

    // Method without return type: methodName(args) {
    const keywords = ['if', 'for', 'while', 'switch', 'catch', 'function', 'class'];
    const keywordPattern = keywords.join('|');

    // Generic method pattern - non-keyword followed by ()
    result = result.replace(
        new RegExp(`(?<!(?:${keywordPattern}))\\b(\\w+)\\s*\\(`, 'g'),
        (match, name) => {
            // Don't modify if it's a keyword
            if (keywords.includes(name)) {
                return match;
            }
            return `${name}(`;
        }
    );

    return result;
}
