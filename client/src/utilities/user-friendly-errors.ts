/**
 * Custom user-friendly error messages for each API operation
 * Provides specific, helpful messages in English for different endpoints and operations
 */

import { ErrorType } from '@/types/api';
import type { ApiErrorContext } from '@/api/api-error';

interface ErrorMessageMap {
    [key: string]: {
        [method: string]: {
            [errorType: string]: string;
        };
    };
}

/**
 * Custom messages for each API endpoint and operation
 * Format: endpoint -> method -> errorType -> message
 */
const CUSTOM_ERROR_MESSAGES: ErrorMessageMap = {
    // Trajectories
    'trajectories': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to load trajectories.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view these trajectories.',
            [ErrorType.NOT_FOUND]: 'The trajectory collection doesn\'t exist.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading trajectories again.',
            [ErrorType.TIMEOUT]: 'Loading trajectories took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading trajectories. Please try again later.',
            [ErrorType.VALIDATION]: 'Invalid trajectory filters. Please check your parameters.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before loading trajectories again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Trajectory service is temporarily unavailable. Please try again later.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to upload trajectories.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to upload trajectories.',
            [ErrorType.VALIDATION]: 'Invalid trajectory file or format. Please check the file and try again.',
            [ErrorType.CONFLICT]: 'A trajectory with this name already exists. Choose a different name.',
            [ErrorType.NETWORK]: 'Connection error during upload. Please check your internet connection.',
            [ErrorType.TIMEOUT]: 'Trajectory upload took too long. Please try uploading again.',
            [ErrorType.SERVER_ERROR]: 'Server error during trajectory upload. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many uploads in progress. Please wait before uploading again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Upload service is temporarily unavailable. Please try again later.',
        },
        PATCH: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to update the trajectory.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to update this trajectory.',
            [ErrorType.NOT_FOUND]: 'Trajectory not found. It may have been deleted.',
            [ErrorType.VALIDATION]: 'Invalid trajectory data. Please check the information and try again.',
            [ErrorType.CONFLICT]: 'Trajectory was modified by someone else. Please refresh and try again.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try updating again.',
            [ErrorType.TIMEOUT]: 'Update took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while updating trajectory. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many updates. Please wait before updating again.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to delete the trajectory.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to delete this trajectory.',
            [ErrorType.NOT_FOUND]: 'Trajectory not found. It may have been already deleted.',
            [ErrorType.CONFLICT]: 'Cannot delete trajectory. It might be in use.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try deleting again.',
            [ErrorType.TIMEOUT]: 'Deletion took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while deleting trajectory. Please try again later.',
        },
    },

    // Teams
    'teams': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to view teams.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view these teams.',
            [ErrorType.NOT_FOUND]: 'Team not found.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading teams again.',
            [ErrorType.TIMEOUT]: 'Loading teams took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading teams. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before loading teams again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to create a team.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to create teams.',
            [ErrorType.VALIDATION]: 'Invalid team information. Please check the name and try again.',
            [ErrorType.CONFLICT]: 'Team name already exists. Choose a different name.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try creating a team again.',
            [ErrorType.TIMEOUT]: 'Team creation took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while creating team. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many team creations. Please wait before creating another team.',
        },
        PATCH: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to update the team.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to update this team.',
            [ErrorType.NOT_FOUND]: 'Team not found. It may have been deleted.',
            [ErrorType.VALIDATION]: 'Invalid team data. Please check the information and try again.',
            [ErrorType.CONFLICT]: 'Team was modified by someone else. Please refresh and try again.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try updating again.',
            [ErrorType.TIMEOUT]: 'Update took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while updating team. Please try again later.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to delete the team.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to delete this team.',
            [ErrorType.NOT_FOUND]: 'Team not found. It may have been already deleted.',
            [ErrorType.CONFLICT]: 'Cannot delete team. It has active members or projects.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try deleting again.',
            [ErrorType.TIMEOUT]: 'Deletion took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while deleting team. Please try again later.',
        },
    },

    // Chat
    'chat': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to load messages.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view this chat.',
            [ErrorType.NOT_FOUND]: 'Chat not found.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading messages again.',
            [ErrorType.TIMEOUT]: 'Loading messages took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading messages. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many message requests. Please wait before trying again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to send a message.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to send messages in this chat.',
            [ErrorType.VALIDATION]: 'Invalid message. Please check the content and try again.',
            [ErrorType.NOT_FOUND]: 'Chat conversation not found.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try sending the message again.',
            [ErrorType.TIMEOUT]: 'Message sending took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while sending message. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many messages sent. Please wait before sending another message.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to delete the message.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to delete this message.',
            [ErrorType.NOT_FOUND]: 'Message not found. It may have been already deleted.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try deleting again.',
            [ErrorType.TIMEOUT]: 'Deletion took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while deleting message. Please try again later.',
        },
    },

    // Analysis Configuration
    'analysis': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to load analysis configurations.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view analysis configurations.',
            [ErrorType.NOT_FOUND]: 'Analysis configuration not found.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading analysis again.',
            [ErrorType.TIMEOUT]: 'Loading analysis took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading analysis. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many analysis requests. Please wait before trying again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to create analysis.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to create analysis configurations.',
            [ErrorType.VALIDATION]: 'Invalid analysis parameters. Please check the configuration and try again.',
            [ErrorType.NOT_FOUND]: 'Required trajectory or data not found.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try creating analysis again.',
            [ErrorType.TIMEOUT]: 'Analysis creation took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while creating analysis. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many analysis requests. Please wait before creating another.',
        },
        PATCH: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to update analysis.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to update this analysis.',
            [ErrorType.NOT_FOUND]: 'Analysis configuration not found.',
            [ErrorType.VALIDATION]: 'Invalid analysis data. Please check the parameters and try again.',
            [ErrorType.CONFLICT]: 'Analysis was modified by someone else. Please refresh and try again.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try updating again.',
            [ErrorType.TIMEOUT]: 'Update took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while updating analysis. Please try again later.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to delete analysis.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to delete this analysis.',
            [ErrorType.NOT_FOUND]: 'Analysis not found. It may have been already deleted.',
            [ErrorType.CONFLICT]: 'Cannot delete analysis. It may be in use or processing.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try deleting again.',
            [ErrorType.TIMEOUT]: 'Deletion took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while deleting analysis. Please try again later.',
        },
    },

    // Raster (Images/Rendering)
    'raster': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to load images.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view these images.',
            [ErrorType.NOT_FOUND]: 'Image not found. It may have been deleted or expired.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading images again.',
            [ErrorType.TIMEOUT]: 'Image loading took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading images. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many image requests. Please wait before trying again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to generate images.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to generate images.',
            [ErrorType.VALIDATION]: 'Invalid image parameters. Please check your settings and try again.',
            [ErrorType.NOT_FOUND]: 'Required trajectory or configuration not found.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try generating images again.',
            [ErrorType.TIMEOUT]: 'Image generation took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while generating images. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many rendering requests. Please wait before generating more images.',
        },
    },

    // Dislocations Analysis
    'dislocations': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to load dislocation analysis.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to view dislocation analysis.',
            [ErrorType.NOT_FOUND]: 'Dislocation analysis not found.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try loading analysis again.',
            [ErrorType.TIMEOUT]: 'Loading dislocation analysis took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while loading dislocation analysis. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many analysis requests. Please wait before trying again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again to analyze dislocations.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to analyze dislocations.',
            [ErrorType.VALIDATION]: 'Invalid dislocation parameters. Please check the settings and try again.',
            [ErrorType.NOT_FOUND]: 'Required trajectory data not found.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try analyzing again.',
            [ErrorType.TIMEOUT]: 'Analysis took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error while analyzing dislocations. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many analysis requests. Please wait before analyzing again.',
        },
    },

    // Sessions/Authentication
    'session': {
        GET: {
            [ErrorType.AUTH]: 'Your session is no longer valid. Please sign in again.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet connection.',
            [ErrorType.TIMEOUT]: 'Connection check took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
        },
        POST: {
            [ErrorType.AUTH]: 'Invalid credentials. Please check your username and password.',
            [ErrorType.VALIDATION]: 'Missing required login information.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try signing in again.',
            [ErrorType.TIMEOUT]: 'Sign in took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error during sign in. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many login attempts. Please wait before trying again.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired.',
            [ErrorType.NETWORK]: 'Connection error. Check your internet and try signing out again.',
            [ErrorType.TIMEOUT]: 'Sign out took too long. Please refresh the page.',
            [ErrorType.SERVER_ERROR]: 'Server error during sign out. Your session is still valid.',
        },
    },

    // Default fallback
    'default': {
        GET: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to access this resource.',
            [ErrorType.NOT_FOUND]: 'The requested resource was not found.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet connection.',
            [ErrorType.TIMEOUT]: 'Request took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
            [ErrorType.VALIDATION]: 'Invalid request. Please check your input.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before trying again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Service is temporarily unavailable. Please try again later.',
            [ErrorType.UNKNOWN]: 'Something went wrong. Please try again.',
            [ErrorType.CONFLICT]: 'Operation could not be completed. Please try again.',
        },
        POST: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to perform this action.',
            [ErrorType.VALIDATION]: 'Invalid data. Please check your input and try again.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try again.',
            [ErrorType.TIMEOUT]: 'Request took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before trying again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Service is temporarily unavailable. Please try again later.',
            [ErrorType.UNKNOWN]: 'Something went wrong. Please try again.',
            [ErrorType.CONFLICT]: 'Resource already exists or operation conflict.',
            [ErrorType.NOT_FOUND]: 'The required resource was not found.',
        },
        PATCH: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to update this resource.',
            [ErrorType.NOT_FOUND]: 'The resource to update was not found.',
            [ErrorType.VALIDATION]: 'Invalid data. Please check your input and try again.',
            [ErrorType.CONFLICT]: 'Resource was modified elsewhere. Please refresh and try again.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try again.',
            [ErrorType.TIMEOUT]: 'Update took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before trying again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Service is temporarily unavailable. Please try again later.',
            [ErrorType.UNKNOWN]: 'Update failed. Please try again.',
        },
        DELETE: {
            [ErrorType.AUTH]: 'Your session expired. Please sign in again.',
            [ErrorType.FORBIDDEN]: 'You don\'t have permission to delete this resource.',
            [ErrorType.NOT_FOUND]: 'The resource to delete was not found.',
            [ErrorType.CONFLICT]: 'Cannot delete resource. It may be in use.',
            [ErrorType.NETWORK]: 'Connection error. Please check your internet and try again.',
            [ErrorType.TIMEOUT]: 'Deletion took too long. Please try again.',
            [ErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
            [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait before trying again.',
            [ErrorType.CIRCUIT_BREAKER_OPEN]: 'Service is temporarily unavailable. Please try again later.',
            [ErrorType.UNKNOWN]: 'Deletion failed. Please try again.',
            [ErrorType.VALIDATION]: 'Cannot delete. Invalid resource state.',
        },
    },
};

/**
 * Extract the main resource from an endpoint
 */
const getEndpointResource = (endpoint: string): string => {
    const normalized = endpoint.toLowerCase();
    
    // Check for specific resources
    if (normalized.includes('trajectories')) return 'trajectories';
    if (normalized.includes('teams')) return 'teams';
    if (normalized.includes('chat')) return 'chat';
    if (normalized.includes('analysis')) return 'analysis';
    if (normalized.includes('raster')) return 'raster';
    if (normalized.includes('dislocations')) return 'dislocations';
    if (normalized.includes('session') || normalized.includes('auth')) return 'session';
    
    return 'default';
};

/**
 * Get custom error message for a specific API operation
 */
export const getCustomErrorMessage = (
    endpoint: string,
    method: string,
    errorType: ErrorType
): string => {
    const resource = getEndpointResource(endpoint);
    const upperMethod = method.toUpperCase();
    
    // Try to get custom message for this specific resource and method
    const resourceMessages = CUSTOM_ERROR_MESSAGES[resource];
    if (resourceMessages) {
        const methodMessages = resourceMessages[upperMethod];
        if (methodMessages && methodMessages[errorType]) {
            return methodMessages[errorType];
        }
    }
    
    // Fallback to default messages
    const defaultMessages = CUSTOM_ERROR_MESSAGES['default'];
    const methodMessages = defaultMessages[upperMethod] || defaultMessages['GET'];
    return methodMessages[errorType] || methodMessages[ErrorType.UNKNOWN] || 'An error occurred. Please try again.';
};

/**
 * Build final user message with custom error handling
 */
export const buildUserMessage = (
    errorType: ErrorType,
    context?: ApiErrorContext
): string => {
    if (!context) {
        return CUSTOM_ERROR_MESSAGES['default']['GET'][errorType] || 'An error occurred. Please try again.';
    }

    return getCustomErrorMessage(
        context.endpoint || '',
        context.method || 'GET',
        errorType
    );
};
