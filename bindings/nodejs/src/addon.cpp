#include <napi.h>
#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/core/lammps_parser.h>
#include <nlohmann/json.hpp>
#include <filesystem>
#include <stdexcept>
#include <vector>
#include <string>
#include <memory>
#include <chrono>
#include <cmath>

using json = nlohmann::json;
using namespace OpenDXA;

// Global analyzer instance
static DislocationAnalysis globalAnalyzer;

// Thread-safe function reference for progress callback
static std::shared_ptr<Napi::ThreadSafeFunction> globalProgressCallback;

Napi::Value JsonToNapi(Napi::Env env, const json& value){
    try{
        if(value.is_discarded() || value.is_null()){
            return env.Null();
        }
        
        try{
            std::string typeCheck = value.type_name();
            if(typeCheck.empty()){
                std::cerr << "Warning: JSON type_name is empty, possible corruption" << std::endl;
                return env.Null();
            }
        }catch(...){
            std::cerr << "Error: Cannot access JSON type, memory corruption detected" << std::endl;
            return env.Null();
        }
        
        if(value.is_boolean()){
            return Napi::Boolean::New(env, value.get<bool>());
        }else if(value.is_number_integer()){
            return Napi::Number::New(env, value.get<int64_t>());
        }else if(value.is_number_unsigned()){
            return Napi::Number::New(env, value.get<uint64_t>());
        }else if(value.is_number_float()){
            double val = value.get<double>();
            if(std::isnan(val) || std::isinf(val)){
                return Napi::Number::New(env, 0.0);
            }
            return Napi::Number::New(env, val);
        }else if(value.is_string()){
            std::string str = value.get<std::string>();
            return Napi::String::New(env, str);
        }else if(value.is_array()){
            size_t arraySize = value.size();
            Napi::Array arr = Napi::Array::New(env);
            for(size_t i = 0; i < arraySize; i++){
                try{
                    arr[i] = JsonToNapi(env, value[i]);
                }catch(const std::exception& e){
                    std::cerr << "Error converting array element " << i << ": " << e.what() << std::endl;
                    arr[i] = env.Null();
                }catch(...){
                    std::cerr << "Unknown error converting array element " << i << std::endl;
                    arr[i] = env.Null();
                }
            }
            return arr;
        }else if(value.is_object()){
            Napi::Object obj = Napi::Object::New(env);
            
            try{
                for(const auto& item : value.items()){
                    try{
                        const std::string& key = item.key();
                        const json& val = item.value();
                        
                        obj.Set(key, JsonToNapi(env, val));
                    }catch(const json::exception& je){
                        std::cerr << "JSON exception on property: " << je.what() << std::endl;
                        continue;
                    }catch(const std::exception& e){
                        std::cerr << "Error converting object property: " << e.what() << std::endl;
                        continue; 
                    }catch(...){
                        std::cerr << "Unknown error converting object property" << std::endl;
                        continue; 
                    }
                }
            }catch(const json::exception& je){
                std::cerr << "JSON exception iterating object: " << je.what() << std::endl;
                return Napi::String::New(env, "[Object Error: " + std::string(je.what()) + "]");
            }catch(const std::exception& e){
                std::cerr << "Error iterating JSON object: " << e.what() << std::endl;
                return Napi::String::New(env, "[Object Error: " + std::string(e.what()) + "]");
            }
            return obj;
        }else{
            // Unknown type, convert to string safely
            try{
                std::string dump = value.dump();
                return Napi::String::New(env, dump);
            }catch(...){
                return Napi::String::New(env, "[Unparseable JSON]");
            }
        }
    }catch(const json::exception& je){
        std::cerr << "JSON exception in JsonToNapi: " << je.what() << std::endl;
        return Napi::String::New(env, "JSON_ERROR: " + std::string(je.what()));
    }catch(const std::exception& e){
        std::cerr << "General exception in JsonToNapi: " << e.what() << std::endl;
        return Napi::String::New(env, "ERROR: " + std::string(e.what()));
    }catch(...){
        std::cerr << "Unknown exception in JsonToNapi" << std::endl;
        return Napi::String::New(env, "UNKNOWN_ERROR");
    }
}

void progressCallbackWrapper(const ProgressInfo& info){
    if(!globalProgressCallback){
        return; 
    }
    
    json frameResultCopy;
    bool hasValidFrameResult = false;
    
    if(info.frameResult){
        try{
            // Create a safe copy to avoid memory issues
            frameResultCopy = *info.frameResult;
            hasValidFrameResult = true;
        }catch(const std::exception& e){
            std::cerr << "Error copying frame result: " << e.what() << std::endl;
            hasValidFrameResult = false;
        }catch(...){
            std::cerr << "Unknown error copying frame result" << std::endl;
            hasValidFrameResult = false;
        }
    }
    
    auto callback = [info, frameResultCopy, hasValidFrameResult](Napi::Env env, Napi::Function jsCallback){
        try{
            if(env.IsExceptionPending()){
                std::cerr << "Warning: Exception pending in environment" << std::endl;
                return;
            }
            
            // Create progress info object for JavaScript
            Napi::Object progressObj = Napi::Object::New(env);
            
            try{
                progressObj.Set("completedFrames", Napi::Number::New(env, info.completedFrames));
                progressObj.Set("totalFrames", Napi::Number::New(env, info.totalFrames));
                
                // Calculate progress percentage safely
                double progressPercent = 0.0;
                if(info.totalFrames > 0){
                    progressPercent =(static_cast<double>(info.completedFrames) / info.totalFrames) * 100.0;
                    if(std::isnan(progressPercent) || std::isinf(progressPercent)){
                        progressPercent = 0.0;
                    }
                }
                progressObj.Set("progressPercent", Napi::Number::New(env, progressPercent));
                
                // Add timing information safely
                auto now = std::chrono::high_resolution_clock::now();
                auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                    now.time_since_epoch()).count();
                progressObj.Set("timestamp", Napi::Number::New(env, timestamp));
                
            }catch(const std::exception& e){
                std::cerr << "Error setting basic progress info: " << e.what() << std::endl;
                return; // Don't call callback if basic info fails
            }
            
            if(hasValidFrameResult){
                try{
                    // Debug info(but limited to prevent spam)
                    static int debugCount = 0;
                    if(debugCount < 5){ // Only debug first 5 frames
                        std::cerr << "Converting frame result, type: " << frameResultCopy.type_name() 
                                 << ", size: " <<(frameResultCopy.is_structured() ? frameResultCopy.size() : 0) << std::endl;
                        debugCount++;
                    }
                    
                    Napi::Value convertedResult = JsonToNapi(env, frameResultCopy);
                    progressObj.Set("frameResult", convertedResult);
                    
                }catch(const std::exception& e){
                    std::cerr << "Error converting frame result: " << e.what() << std::endl;
                    progressObj.Set("frameResult", env.Null());
                    progressObj.Set("frameResultError", Napi::String::New(env, e.what()));
                }catch(...){
                    std::cerr << "Unknown error converting frame result" << std::endl;
                    progressObj.Set("frameResult", env.Null());
                    progressObj.Set("frameResultError", Napi::String::New(env, "Unknown conversion error"));
                }
            }else{
                progressObj.Set("frameResult", env.Null());
            }
            
            try{
                if(env.IsExceptionPending()){
                    std::cerr << "Warning: Exception pending before callback" << std::endl;
                    return;
                }
                
                jsCallback.Call({progressObj});
                
                if(env.IsExceptionPending()){
                    std::cerr << "Warning: Exception pending after callback" << std::endl;
                }
                
            }catch(const std::exception& e){
                std::cerr << "Error calling JavaScript callback: " << e.what() << std::endl;
            }catch(...){
                std::cerr << "Unknown error calling JavaScript callback" << std::endl;
            }
            
        }catch(const std::exception& e){
            std::cerr << "Error in progress callback wrapper: " << e.what() << std::endl;
        }catch(...){
            std::cerr << "Unknown error in progress callback wrapper" << std::endl;
        }
    };
    
    try{
        if(globalProgressCallback){
            globalProgressCallback->NonBlockingCall(callback);
        }
    }catch(const std::exception& e){
        std::cerr << "Error calling progress callback: " << e.what() << std::endl;
    }catch(...){
        std::cerr << "Unknown error calling progress callback" << std::endl;
    }
}

// Async Worker for trajectory computation
class ComputeTrajectoryWorker : public Napi::AsyncWorker{
public:
    ComputeTrajectoryWorker(Napi::Function& callback, 
                           const std::vector<std::string>& inputFiles,
                           const std::string& outputTemplate)
        : Napi::AsyncWorker(callback), inputFiles(inputFiles), outputTemplate(outputTemplate){}
        
    ~ComputeTrajectoryWorker(){}
    
    void Execute() override{
        try{
            if(inputFiles.empty()){
                SetError("Input file list cannot be empty");
                return;
            }
            
            // Parse all LAMMPS files into frames
            std::vector<LammpsParser::Frame> frames;
            frames.reserve(inputFiles.size());
            LammpsParser parser;
            
            for(const auto& filePath : inputFiles){
                if(!std::filesystem::exists(filePath)){
                    SetError("Input file does not exist: " + filePath);
                    return;
                }
                
                LammpsParser::Frame frame;
                if(!parser.parseFile(filePath, frame)){
                    SetError("Failed to parse input file: " + filePath);
                    return;
                }
                frames.push_back(std::move(frame));
            }
            
            // Run trajectory analysis with progress callback
            result = globalAnalyzer.compute(frames, outputTemplate, progressCallbackWrapper);
            
        }catch(const std::exception& e){
            SetError(e.what());
        }
    }
    
    void OnOK() override{
        Napi::HandleScope scope(Env());
        
        try{
            if(globalProgressCallback){
                std::cerr << "Cleaning up progress callback after trajectory completion" << std::endl;
                try{
                    globalProgressCallback->Release();
                }catch(...){
                    std::cerr << "Error releasing progress callback" << std::endl;
                }
                globalProgressCallback.reset();
            }
            
            Napi::Value napiResult = JsonToNapi(Env(), result);
            Callback().Call({Env().Null(), napiResult});
        }catch(const std::exception& e){
            Napi::Error error = Napi::Error::New(Env(), std::string("Failed to convert result: ") + e.what());
            Callback().Call({error.Value(), Env().Undefined()});
        }
    }
    
    void OnError(const Napi::Error& e) override{
        Napi::HandleScope scope(Env());
        
        if(globalProgressCallback){
            try{
                globalProgressCallback->Release();
                globalProgressCallback.reset();
            }catch(...){
                std::cerr << "Error releasing progress callback on error" << std::endl;
            }
        }
        
        Callback().Call({e.Value(), Env().Undefined()});
    }
    
private:
    std::vector<std::string> inputFiles;
    std::string outputTemplate;
    json result;
};

Napi::Value ClearProgressCallback(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(globalProgressCallback){
        try{
            std::cerr << "Manually clearing progress callback" << std::endl;
            globalProgressCallback->Release();
            globalProgressCallback.reset();
            std::cerr << "Progress callback cleared successfully" << std::endl;
        }catch(const std::exception& e){
            std::cerr << "Error clearing progress callback: " << e.what() << std::endl;
        }catch(...){
            std::cerr << "Unknown error clearing progress callback" << std::endl;
        }
    }
    
    return env.Undefined();
}

Napi::Value SetProgressCallback(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(globalProgressCallback){
        try{
            globalProgressCallback->Release();
        }catch(...){
            std::cerr << "Error releasing previous callback" << std::endl;
        }
        globalProgressCallback.reset();
    }
    
    if(info.Length() < 1){
        return env.Undefined();
    }
    
    if(!info[0].IsFunction()){
        Napi::TypeError::New(env, "Expected function argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    Napi::Function callback = info[0].As<Napi::Function>();
    
    try{
        globalProgressCallback = std::make_shared<Napi::ThreadSafeFunction>(
            Napi::ThreadSafeFunction::New(
                env,
                callback,
                "ProgressCallback",
                0, // Unlimited queue
                1, // Only one thread will use this
                [](Napi::Env env){
                    // Finalizer - cleanup when no longer needed
                    std::cerr << "Progress callback finalizer called" << std::endl;
                }
            )
        );
    }catch(const std::exception& e){
        Napi::Error::New(env, std::string("Failed to create progress callback: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    return env.Undefined();
}
Napi::Value ComputeTrajectory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "An array of file paths is required as the first argument.").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Array inputArray = info[0].As<Napi::Array>();
    std::vector<std::string> inputFiles;
    inputFiles.reserve(inputArray.Length());
    for (uint32_t i = 0; i < inputArray.Length(); i++) {
        Napi::Value val = inputArray[i];
        if (val.IsString()) {
            inputFiles.push_back(val.As<Napi::String>().Utf8Value());
        } else {
            Napi::TypeError::New(env, "The file path array must contain only strings.").ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }

    bool isAsync = info.Length() > 1 && info[info.Length() - 1].IsFunction();

    std::string outputTemplate = "";
    if (info.Length() > 1 && info[1].IsString()) {
        outputTemplate = info[1].As<Napi::String>().Utf8Value();
    }

    if (isAsync) {
        Napi::Function callback = info[info.Length() - 1].As<Napi::Function>();
        ComputeTrajectoryWorker* worker = new ComputeTrajectoryWorker(callback, inputFiles, outputTemplate);
        worker->Queue();
        return env.Undefined();
    }else {
        try {
            if (inputFiles.empty()) {
                throw std::invalid_argument("The input file list cannot be empty");
            }

            std::vector<LammpsParser::Frame> frames;
            frames.reserve(inputFiles.size());
            LammpsParser parser;

            for (const auto& filePath : inputFiles) {
                if (!std::filesystem::exists(filePath)) {
                    throw std::runtime_error("The input file does not exist: " + filePath);
                }

                LammpsParser::Frame frame;
                if (!parser.parseFile(filePath, frame)) {
                    throw std::runtime_error("Failed to parse input file: " + filePath);
                }
                frames.push_back(std::move(frame));
            }

            json result = globalAnalyzer.compute(frames, outputTemplate, progressCallbackWrapper);
            return JsonToNapi(env, result);
        }catch (const std::exception& e) {
            Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }
}

// Static wrapper functions
Napi::Value SetMaxTrialCircuitSize(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double circuitSize = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setMaxTrialCircuitSize(circuitSize);
    
    return env.Undefined();
}

Napi::Value SetCircuitStretchability(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double stretchability = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setCircuitStretchability(stretchability);
    
    return env.Undefined();
}

Napi::Value SetOnlyPerfectDislocations(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsBoolean()){
        Napi::TypeError::New(env, "Expected boolean argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    bool onlyPerfect = info[0].As<Napi::Boolean>().Value();
    globalAnalyzer.setOnlyPerfectDislocations(onlyPerfect);
    
    return env.Undefined();
}

Napi::Value SetMarkCoreAtoms(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsBoolean()){
        Napi::TypeError::New(env, "Expected boolean argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    bool markCore = info[0].As<Napi::Boolean>().Value();
    globalAnalyzer.setMarkCoreAtoms(markCore);
    
    return env.Undefined();
}

Napi::Value SetLineSmoothingLevel(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double smoothingLevel = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setLineSmoothingLevel(smoothingLevel);
    
    return env.Undefined();
}

Napi::Value SetLinePointInterval(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double pointInterval = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setLinePointInterval(pointInterval);
    
    return env.Undefined();
}

Napi::Value SetDefectMeshSmoothingLevel(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double smoothingLevel = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setDefectMeshSmoothingLevel(smoothingLevel);
    
    return env.Undefined();
}

Napi::Value SetCrystalStructure(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int structure = info[0].As<Napi::Number>().Int32Value();
    globalAnalyzer.setInputCrystalStructure(static_cast<LatticeStructureType>(structure));
    
    return env.Undefined();
}

Napi::Value SetIdentificationMode(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int mode = info[0].As<Napi::Number>().Int32Value();
    globalAnalyzer.setIdentificationMode(static_cast<StructureAnalysis::Mode>(mode));
    
    return env.Undefined();
}

Napi::Value Compute(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsString()){
        Napi::TypeError::New(env, "Expected string argument for input file").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string inputFile = info[0].As<Napi::String>().Utf8Value();
    std::string outputFile = info.Length() > 1 && info[1].IsString() ? 
        info[1].As<Napi::String>().Utf8Value() : "";
    
    try{
        if(inputFile.empty()){
            throw std::invalid_argument("Input file path cannot be empty");
        }
        
        if(!std::filesystem::exists(inputFile)){
            throw std::runtime_error("Input file does not exist: " + inputFile);
        }
        
        LammpsParser parser;
        LammpsParser::Frame frame;
        if(!parser.parseFile(inputFile, frame)){
            throw std::runtime_error("Failed to parse input file: " + inputFile);
        }
        
        json result = globalAnalyzer.compute(frame, outputFile);
        return JsonToNapi(env, result);
        
    }catch(const std::exception& e){
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

void CleanupModule(void* arg){
    std::cerr << "Cleaning up OpenDXA module..." << std::endl;
    if(globalProgressCallback){
        try{
            globalProgressCallback->Release();
        }catch(...){
            std::cerr << "Error releasing callback during cleanup" << std::endl;
        }
        globalProgressCallback.reset();
    }
    std::cerr << "OpenDXA module cleanup complete" << std::endl;
}

// Initialize the module
Napi::Object Init(Napi::Env env, Napi::Object exports){
    napi_add_env_cleanup_hook(env, CleanupModule, nullptr);

    // Export functions
    exports.Set("compute", Napi::Function::New(env, Compute));
    exports.Set("setMaxTrialCircuitSize", Napi::Function::New(env, SetMaxTrialCircuitSize));
    exports.Set("setCircuitStretchability", Napi::Function::New(env, SetCircuitStretchability));
    exports.Set("setOnlyPerfectDislocations", Napi::Function::New(env, SetOnlyPerfectDislocations));
    exports.Set("setMarkCoreAtoms", Napi::Function::New(env, SetMarkCoreAtoms));
    exports.Set("setLineSmoothingLevel", Napi::Function::New(env, SetLineSmoothingLevel));
    exports.Set("setLinePointInterval", Napi::Function::New(env, SetLinePointInterval));
    exports.Set("setDefectMeshSmoothingLevel", Napi::Function::New(env, SetDefectMeshSmoothingLevel));
    exports.Set("setCrystalStructure", Napi::Function::New(env, SetCrystalStructure));
    exports.Set("setIdentificationMode", Napi::Function::New(env, SetIdentificationMode));
    
    exports.Set("computeTrajectory", Napi::Function::New(env, ComputeTrajectory));
    exports.Set("setProgressCallback", Napi::Function::New(env, SetProgressCallback));
    exports.Set("clearProgressCallback", Napi::Function::New(env, ClearProgressCallback));
    
    // Export constants
    Napi::Object latticeStructure = Napi::Object::New(env);
    latticeStructure.Set("FCC", Napi::Number::New(env, LATTICE_FCC));
    latticeStructure.Set("BCC", Napi::Number::New(env, LATTICE_BCC));
    latticeStructure.Set("HCP", Napi::Number::New(env, LATTICE_HCP));
    exports.Set("LatticeStructure", latticeStructure);
    
    Napi::Object identificationMode = Napi::Object::New(env);
    identificationMode.Set("PTM", Napi::Number::New(env, StructureAnalysis::PTM));
    identificationMode.Set("CNA", Napi::Number::New(env, StructureAnalysis::CNA));
    exports.Set("IdentificationMode", identificationMode);
    
    std::cerr << "OpenDXA Node.js bindings initialized successfully" << std::endl;
    
    return exports;
}

NODE_API_MODULE(opendxa_fixed, Init)