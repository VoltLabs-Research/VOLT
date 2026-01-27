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

export function formatControlFlow(code: string): string {
    let result = code;

    // Remove space before ( in control structures - same line only
    // if ( -> if(
    result = result.replace(/\b(if|for|while|switch|do)[ \t]+\(/g, '$1(');

    // Fix } else if { pattern - no line breaks
    // } \n else if ( -> }else if(
    result = result.replace(/\}[ \t]*\n[ \t]*else[ \t]+if[ \t]*\(/g, '}else if(');
    result = result.replace(/\}[ \t]+else[ \t]+if[ \t]*\(/g, '}else if(');

    // Fix } else { pattern - no line breaks
    // } \n else { -> }else{
    result = result.replace(/\}[ \t]*\n[ \t]*else[ \t]*\{/g, '}else{');
    result = result.replace(/\}[ \t]+else[ \t]*\{/g, '}else{');

    // Ensure opening brace on same line for control structures
    // if(x) \n { -> if(x){
    result = result.replace(/(if\([^)]+\))[ \t]*\n[ \t]*\{/g, '$1{');
    result = result.replace(/(else[ \t]*if\([^)]+\))[ \t]*\n[ \t]*\{/g, '$1{');
    result = result.replace(/(for\([^)]+\))[ \t]*\n[ \t]*\{/g, '$1{');
    result = result.replace(/(while\([^)]+\))[ \t]*\n[ \t]*\{/g, '$1{');
    result = result.replace(/(switch\([^)]+\))[ \t]*\n[ \t]*\{/g, '$1{');

    // Remove space before { in control structures - same line only
    // if(x) { -> if(x){
    result = result.replace(/(if\([^)]+\))[ \t]+\{/g, '$1{');
    result = result.replace(/(else)[ \t]+\{/g, '$1{');
    result = result.replace(/(for\([^)]+\))[ \t]+\{/g, '$1{');
    result = result.replace(/(while\([^)]+\))[ \t]+\{/g, '$1{');
    result = result.replace(/(switch\([^)]+\))[ \t]+\{/g, '$1{');
    result = result.replace(/(do)[ \t]+\{/g, '$1{');

    // Fix do-while: }while(
    result = result.replace(/\}[ \t]*\n[ \t]*while[ \t]*\(/g, '}while(');
    result = result.replace(/\}[ \t]+while[ \t]*\(/g, '}while(');

    return result;
}
