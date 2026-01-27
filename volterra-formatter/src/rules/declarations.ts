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

// Use [ \t] for horizontal whitespace only (not newlines)
// Use [^\S\n] as alternative for "whitespace but not newline"

export function formatDeclarations(code: string): string {
    let result = code;

    // Regular function declarations
    // function name () -> function name()
    // Use [ \t]+ to avoid matching across lines
    result = result.replace(/\bfunction[ \t]+(\w+)[ \t]*\(/g, 'function $1(');

    // Function body brace - only on same line
    // function name() { -> function name(){
    result = result.replace(/(function[ \t]+\w+\([^)]*\))[ \t]+\{/g, '$1{');

    // Function with brace on next line - bring it up
    result = result.replace(/(function[ \t]+\w+\([^)]*\))[ \t]*\n[ \t]*\{/g, '$1{');

    // Type annotations: function name(): Type { - same line only
    // Use [^{\n]+ to not match across lines
    result = result.replace(/(function[ \t]+\w+\([^)]*\)[ \t]*:[ \t]*[^{\n]+)[ \t]+\{/g, '$1{');

    // Class declarations
    // class Name { -> class Name{
    result = result.replace(/\bclass[ \t]+(\w+)[ \t]*\{/g, 'class $1{');
    result = result.replace(/\bclass[ \t]+(\w+)[ \t]*\n[ \t]*\{/g, 'class $1{');

    // Class with extends
    // class Foo extends Bar { -> class Foo extends Bar{
    result = result.replace(/\bclass[ \t]+(\w+)[ \t]+extends[ \t]+(\w+)[ \t]*\{/g, 'class $1 extends $2{');

    // Class with implements - use [^{\n]+ to not cross lines
    result = result.replace(/\bclass[ \t]+(\w+)[ \t]+implements[ \t]+([^{\n]+)[ \t]*\{/g, 'class $1 implements $2{');

    // Export class
    result = result.replace(/\bexport[ \t]+(default[ \t]+)?class[ \t]+(\w+)/g, 'export $1class $2');

    // Constructor
    // constructor () -> constructor()
    result = result.replace(/\bconstructor[ \t]*\(/g, 'constructor(');
    result = result.replace(/(constructor\([^)]*\))[ \t]+\{/g, '$1{');
    result = result.replace(/(constructor\([^)]*\))[ \t]*\n[ \t]*\{/g, '$1{');

    // Methods in classes (async and regular)
    // Method with return type: methodName(args): ReturnType { - same line only
    // Use [^{\n]+ to avoid crossing lines
    result = result.replace(/(\w+\([^)]*\)[ \t]*:[ \t]*[^{\n]+)[ \t]+\{/g, '$1{');

    // Method without return type: methodName(args) {
    // Exclude keywords that need space before (
    const keywords = ['if', 'for', 'while', 'switch', 'catch', 'function', 'class', 'return', 'throw', 'new', 'typeof', 'await', 'delete', 'void', 'yield'];
    const keywordPattern = keywords.join('|');

    // Generic method pattern - non-keyword followed by ()
    // Only match on same line (use [ \t]* not \s*)
    result = result.replace(
        new RegExp(`(?<!(?:${keywordPattern}))\\b(\\w+)[ \\t]*\\(`, 'g'),
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
