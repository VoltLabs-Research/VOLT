/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { FilterQuery, Types } from 'mongoose';
import { join } from 'node:path';


// Type for async request handlers that may throw errors
type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<void | Response>;

// MongoDB ObjectId validation regex
const MONGODB_OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;

// Slug validation regex(alphanumeric, hyphens, underscores)
const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

// Maximum slug length for security
const MAX_SLUG_LENGTH = 100;

export const slugify = (value: string) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

/**
 * Catches async errors in Express route handlers and passes them to the error middleware.
 * This eliminate the need for try-catch blocks in every async route handler.
 *
 * @template T - The type of the async function
 * @param asyncFn - The async function to wrap
 * @returns A wrapped Express RequestHandler that catches async errors
*/
export const catchAsync = <T extends AsyncRequestHandler>(asyncFn: T): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Execute the async function and catch any rejected promises
        Promise.resolve(asyncFn(req, res, next)).catch(next);
    };
};

/**
 * Filters an object to only include specified fields, providing type safety
 * and protection against prototype pollution.
 *
 * @template T - The type of the input object
 * @param obj - The object to filter
 * @param allowedFields - Array of field names to include
 * @returns A new object containing only the allowed fields
*/
export const filterObject = <T extends object>(
    obj: T,
    ...allowedFields: readonly string[]
): Partial<T> => {
    // Input validation
    if (!obj || typeof obj !== 'object') {
        return {};
    }

    if (allowedFields.length === 0) {
        return {};
    }

    // Create a set for O(1) field lookup perfomance
    const allowedFieldsSet = new Set(allowedFields);
    const filteredObject: Partial<T> = {};

    // Iterate through object properties
    for (const [key, value] of Object.entries(obj)) {
        // Check f field is allowed and protect against prototype pollution
        if (allowedFieldsSet.has(key) && Object.hasOwnProperty.call(obj, key)) {
            // Skip potentially dangerous properties
            if (isDangerousProperty(key)) {
                continue;
            }

            // Type assertion is safe here as we're copying from the original object
            (filteredObject as any)[key] = value;
        }
    }

    return filteredObject;
};

/**
 * Check if a property name is potentially dangerous(prototype pollution protection)
 * @param propertyName - The property name to check
 * @returns True if the property is dangerous, false otherwise
*/
const isDangerousProperty = (propertyName: string): boolean => {
    const dangerousProperties = new Set([
        '__proto__',
        'constructor',
        'prototype',
        '__defineGetter__',
        '__defineSetter__',
        '__lookupGetter__',
        '__lookupSetter__'
    ]);
    return dangerousProperties.has(propertyName);
};

/**
 * Determines wheter a given identifier is a MongoDB ObjectId or a slug,
 * and returns the appropiate MongoDB filter query.
 * @param identifier - The identifier to check(either ObjectId string or slug)
 * @returns MongoDB FilterQuery object for finding documents
 * @throws Error if the identifier is invalid
*/
export const checkIfSlugOrId = (identifier: unknown): FilterQuery<any> => {
    // Input validation
    if (!identifier || typeof identifier !== 'string') {
        throw new Error('Identifier must be a non-empty string');
    }
    const trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.length === 0) {
        throw new Error('Identifier cannot be empty or only whitespace');
    }
    // Check if it's a valid MongoDB ObjectId
    if (isValidObjectId(trimmedIdentifier)) {
        try {
            return { _id: new Types.ObjectId(trimmedIdentifier) }
        } catch (error) {
            throw new Error('Invalid ObjectId format');
        }
    }

    // Check if it's a valid slug
    if (isValidSlug(trimmedIdentifier)) {
        return { slug: trimmedIdentifier };
    }

    // If neither ObjectId nor valid slug
    throw new Error('Identifier must be either a valid MongoDB ObjectId or a valid slug(alphanumeric characters, hyphens, and undescores only)');
};

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param str - String to validate
 * @returns True if valid ObjectId, false otherwise
*/
const isValidObjectId = (str: string): boolean => {
    return str.length === 24 && MONGODB_OBJECTID_REGEX.test(str);
};

/**
 * Validates if a string is a valid slug
 * @param str - String to validate
 * @returns True if valid slug, false otherwise
*/
const isValidSlug = (str: string): boolean => {
    return (
        str.length > 0 &&
        str.length <= MAX_SLUG_LENGTH &&
        SLUG_REGEX.test(str) &&
        !str.startsWith('-') &&
        !str.endsWith('-') &&
        // Prevent consecutive hyphens
        !str.includes('--')
    );
};

/**
 * Type guard to check if a value is a valid MongoDB ObjectId string
 * @param value - Value to check
 * @returns True if value is a valid ObjectId string
*/
export const isObjectIdString = (value: unknown): value is string => {
    return typeof value === 'string' && isValidObjectId(value);
};
