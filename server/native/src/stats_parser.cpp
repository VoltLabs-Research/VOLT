#include <node_api.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#include <cmath>
#include <algorithm>

static inline double fast_atof(const char* p, const char* end) {
    double sign = 1.0;
    
    if (p >= end) return 0.0;
    
    if (*p == '-') {
        sign = -1.0;
        p++;
    } else if (*p == '+') {
        p++;
    }
    
    double intPart = 0.0;
    while (p < end && *p >= '0' && *p <= '9') {
        intPart = intPart * 10.0 + (*p - '0');
        p++;
    }
    
    double fracPart = 0.0;
    double fracDiv = 1.0;
    if (p < end && *p == '.') {
        p++;
        while (p < end && *p >= '0' && *p <= '9') {
            fracPart = fracPart * 10.0 + (*p - '0');
            fracDiv *= 10.0;
            p++;
        }
    }
    
    double result = sign * (intPart + fracPart / fracDiv);
    
    if (p < end && (*p == 'e' || *p == 'E')) {
        p++;
        int expSign = 1;
        if (p < end && *p == '-') {
            expSign = -1;
            p++;
        } else if (p < end && *p == '+') {
            p++;
        }
        int exp = 0;
        while (p < end && *p >= '0' && *p <= '9') {
            exp = exp * 10 + (*p - '0');
            p++;
        }
        result *= pow(10.0, expSign * exp);
    }
    
    return result;
}

struct StatsResult {
    double min;
    double max;
};

static StatsResult get_stats_native(const char* filepath, int propIdx) {
    StatsResult result = { 1e300, -1e300 };
    
    int fd = open(filepath, O_RDONLY);
    if (fd < 0) return result;
    
    struct stat sb;
    if (fstat(fd, &sb) < 0) {
        close(fd);
        return result;
    }
    
    size_t fileSize = sb.st_size;
    const char* data = (const char*)mmap(nullptr, fileSize, PROT_READ, MAP_PRIVATE, fd, 0);
    if (data == MAP_FAILED) {
        close(fd);
        return result;
    }
    
    // Advise kernel for sequential access
    madvise((void*)data, fileSize, MADV_SEQUENTIAL);
    
    const char* end = data + fileSize;
    const char* p = data;
    
    // Find ITEM: ATOMS
    const char* atomsMarker = "ITEM: ATOMS";
    const char* atomsStart = (const char*)memmem(data, fileSize, atomsMarker, 11);
    if (!atomsStart) {
        munmap((void*)data, fileSize);
        close(fd);
        return result;
    }
    
    // Skip to next line
    p = atomsStart;
    while (p < end && *p != '\n') p++;
    p++; // Skip newline
    
    // Process lines until next ITEM: or EOF
    while (p < end) {
        // Check for next ITEM:
        if (*p == 'I' && p + 4 < end && p[4] == ':') {
            break;
        }
        
        // Find end of line
        const char* lineEnd = p;
        while (lineEnd < end && *lineEnd != '\n') lineEnd++;
        
        // Skip leading whitespace
        while (p < lineEnd && (*p == ' ' || *p == '\t')) p++;
        
        // Parse fields
        int fieldIdx = 0;
        while (p < lineEnd) {
            const char* tokenStart = p;
            while (p < lineEnd && *p != ' ' && *p != '\t') p++;
            
            if (fieldIdx == propIdx) {
                double val = fast_atof(tokenStart, p);
                if (val < result.min) result.min = val;
                if (val > result.max) result.max = val;
                break;
            }
            
            fieldIdx++;
            while (p < lineEnd && (*p == ' ' || *p == '\t')) p++;
        }
        
        // Move to next line
        p = lineEnd + 1;
    }
    
    munmap((void*)data, fileSize);
    close(fd);
    
    if (result.min > 1e299) result.min = 0;
    if (result.max < -1e299) result.max = 0;
    
    return result;
}

// N-API wrapper for file-based stats
static napi_value GetStatsForProperty(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    // Get filepath
    size_t pathLen;
    napi_get_value_string_utf8(env, args[0], nullptr, 0, &pathLen);
    char* filepath = new char[pathLen + 1];
    napi_get_value_string_utf8(env, args[0], filepath, pathLen + 1, &pathLen);
    
    // Get property index
    int32_t propIdx;
    napi_get_value_int32(env, args[1], &propIdx);
    
    // Call native function
    StatsResult stats = get_stats_native(filepath, propIdx);
    
    delete[] filepath;
    
    // Create result object
    napi_value result;
    napi_create_object(env, &result);
    
    napi_value minVal, maxVal;
    napi_create_double(env, stats.min, &minVal);
    napi_create_double(env, stats.max, &maxVal);
    
    napi_set_named_property(env, result, "min", minVal);
    napi_set_named_property(env, result, "max", maxVal);
    
    return result;
}

// N-API wrapper for in-memory Float32Array/Float64Array min/max
static napi_value GetMinMaxFromTypedArray(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    napi_value arr = args[0];
    
    // Check if it's a TypedArray
    bool isTypedArray;
    napi_is_typedarray(env, arr, &isTypedArray);
    
    if (!isTypedArray) {
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        return undefined;
    }
    
    // Get TypedArray info
    napi_typedarray_type type;
    size_t length;
    void* data;
    napi_value arraybuffer;
    size_t byte_offset;
    
    napi_get_typedarray_info(env, arr, &type, &length, &data, &arraybuffer, &byte_offset);
    
    if (length == 0) {
        napi_value result;
        napi_create_object(env, &result);
        napi_value zero;
        napi_create_double(env, 0.0, &zero);
        napi_set_named_property(env, result, "min", zero);
        napi_set_named_property(env, result, "max", zero);
        return result;
    }
    
    double min = 1e300;
    double max = -1e300;
    
    if (type == napi_float32_array) {
        float* arr_data = static_cast<float*>(data);
        for (size_t i = 0; i < length; i++) {
            float val = arr_data[i];
            if (val < min) min = val;
            if (val > max) max = val;
        }
    } else if (type == napi_float64_array) {
        double* arr_data = static_cast<double*>(data);
        for (size_t i = 0; i < length; i++) {
            double val = arr_data[i];
            if (val < min) min = val;
            if (val > max) max = val;
        }
    } else if (type == napi_int32_array) {
        int32_t* arr_data = static_cast<int32_t*>(data);
        for (size_t i = 0; i < length; i++) {
            double val = static_cast<double>(arr_data[i]);
            if (val < min) min = val;
            if (val > max) max = val;
        }
    } else if (type == napi_uint32_array) {
        uint32_t* arr_data = static_cast<uint32_t*>(data);
        for (size_t i = 0; i < length; i++) {
            double val = static_cast<double>(arr_data[i]);
            if (val < min) min = val;
            if (val > max) max = val;
        }
    } else {
        // Unsupported type
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        return undefined;
    }
    
    if (min > 1e299) min = 0;
    if (max < -1e299) max = 0;
    
    napi_value result;
    napi_create_object(env, &result);
    
    napi_value minVal, maxVal;
    napi_create_double(env, min, &minVal);
    napi_create_double(env, max, &maxVal);
    
    napi_set_named_property(env, result, "min", minVal);
    napi_set_named_property(env, result, "max", maxVal);
    
    return result;
}

// N-API wrapper for computing vector magnitudes from array of Float32Arrays
// Input: Array of Float32Arrays (each is a vector [x, y, z, ...])
// Output: Float32Array of magnitudes
static napi_value ComputeMagnitudes(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    napi_value inputArray = args[0];
    
    // Check if it's an array
    bool isArray;
    napi_is_array(env, inputArray, &isArray);
    
    if (!isArray) {
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        return undefined;
    }
    
    // Get array length
    uint32_t length;
    napi_get_array_length(env, inputArray, &length);
    
    if (length == 0) {
        // Return empty Float32Array
        napi_value arraybuffer, result;
        void* data;
        napi_create_arraybuffer(env, 0, &data, &arraybuffer);
        napi_create_typedarray(env, napi_float32_array, 0, arraybuffer, 0, &result);
        return result;
    }
    
    // Allocate output buffer
    napi_value arraybuffer, result;
    void* outData;
    napi_create_arraybuffer(env, length * sizeof(float), &outData, &arraybuffer);
    float* magnitudes = static_cast<float*>(outData);
    
    // Process each vector
    for (uint32_t i = 0; i < length; i++) {
        napi_value element;
        napi_get_element(env, inputArray, i, &element);
        
        // Check if element is a TypedArray (Float32Array)
        bool isTypedArray;
        napi_is_typedarray(env, element, &isTypedArray);
        
        if (isTypedArray) {
            napi_typedarray_type type;
            size_t vecLen;
            void* vecData;
            napi_value ab;
            size_t offset;
            napi_get_typedarray_info(env, element, &type, &vecLen, &vecData, &ab, &offset);
            
            double sum = 0.0;
            if (type == napi_float32_array) {
                float* fdata = static_cast<float*>(vecData);
                for (size_t j = 0; j < vecLen; j++) {
                    sum += fdata[j] * fdata[j];
                }
            } else if (type == napi_float64_array) {
                double* ddata = static_cast<double*>(vecData);
                for (size_t j = 0; j < vecLen; j++) {
                    sum += ddata[j] * ddata[j];
                }
            }
            magnitudes[i] = static_cast<float>(sqrt(sum));
        } else {
            // Check if it's a regular JS array
            bool isJsArray;
            napi_is_array(env, element, &isJsArray);
            
            if (isJsArray) {
                uint32_t vecLen;
                napi_get_array_length(env, element, &vecLen);
                
                double sum = 0.0;
                for (uint32_t j = 0; j < vecLen; j++) {
                    napi_value val;
                    napi_get_element(env, element, j, &val);
                    double num;
                    napi_get_value_double(env, val, &num);
                    sum += num * num;
                }
                magnitudes[i] = static_cast<float>(sqrt(sum));
            } else {
                magnitudes[i] = 0.0f;
            }
        }
    }
    
    napi_create_typedarray(env, napi_float32_array, length, arraybuffer, 0, &result);
    return result;
}

// Module initialization
static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn1, fn2, fn3;
    
    napi_create_function(env, nullptr, 0, GetStatsForProperty, nullptr, &fn1);
    napi_set_named_property(env, exports, "getStatsForProperty", fn1);
    
    napi_create_function(env, nullptr, 0, GetMinMaxFromTypedArray, nullptr, &fn2);
    napi_set_named_property(env, exports, "getMinMaxFromTypedArray", fn2);
    
    napi_create_function(env, nullptr, 0, ComputeMagnitudes, nullptr, &fn3);
    napi_set_named_property(env, exports, "computeMagnitudes", fn3);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)


