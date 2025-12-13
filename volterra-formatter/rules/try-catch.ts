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

export function formatTryCatch(code: string): string {
    let result = code;

    // try { -> try{
    result = result.replace(/\btry\s+\{/g, 'try{');

    // Fix } catch pattern - no line breaks
    // } \n catch(e) { -> }catch(e){
    result = result.replace(/\}\s*\n\s*catch\s*\(/g, '}catch(');
    result = result.replace(/\}\s+catch\s*\(/g, '}catch(');

    // Remove space before ( in catch
    // catch (e) -> catch(e)
    result = result.replace(/\bcatch\s+\(/g, 'catch(');

    // Remove space before { in catch
    // catch(e) { -> catch(e){
    result = result.replace(/(catch\([^)]*\))\s+\{/g, '$1{');
    result = result.replace(/(catch\([^)]*\))\s*\n\s*\{/g, '$1{');

    // Fix } finally { pattern
    result = result.replace(/\}\s*\n\s*finally\s*\{/g, '}finally{');
    result = result.replace(/\}\s+finally\s*\{/g, '}finally{');
    result = result.replace(/\bfinally\s+\{/g, 'finally{');

    return result;
}
