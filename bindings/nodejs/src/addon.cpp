#include <napi.h>
#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/core/lammps_parser.h>
#include <nlohmann/json.hpp>
#include <filesystem>
#include <stdexcept>
#include <vector>
#include <string>
#include <memory>

using json = nlohmann::json;
using namespace OpenDXA;

// Global analyzer instance
static DislocationAnalysis globalAnalyzer;

// Thread-safe function reference for progress callback
static std::shared_ptr<Napi::ThreadSafeFunction> globalProgressCallback;

// Progress callback wrapper that calls JavaScript function
void progressCallbackWrapper(const ProgressInfo& info) {
    if (globalProgressCallback) {
        auto callback = [info](Napi::Env env, Napi::Function jsCallback){
            // Create progress info object for JavaScript
            Napi::Object progressObj = Napi::Object::New(env);
            progressObj.Set("completedFrames", Napi::Number::New(env, info.completedFrames));
            progressObj.Set("totalFrames", Napi::Number::New(env, info.totalFrames));
            
            // Add frame result if available
            if (info.frameResult) {
                Napi::Object frameResult = Napi::Object::New(env);
                for (auto& [key, value] : info.frameResult->items()) {
                    if (value.is_string()) {
                        frameResult.Set(key, Napi::String::New(env, value.get<std::string>()));
                    } else if (value.is_number_integer()) {
                        frameResult.Set(key, Napi::Number::New(env, value.get<int>()));
                    } else if (value.is_number_float()) {
                        frameResult.Set(key, Napi::Number::New(env, value.get<double>()));
                    } else if (value.is_boolean()) {
                        frameResult.Set(key, Napi::Boolean::New(env, value.get<bool>()));
                    }
                }
                progressObj.Set("frameResult", frameResult);
            }
            
            // Call JavaScript callback
            jsCallback.Call({progressObj});
        };
        
        globalProgressCallback->BlockingCall(callback);
    }
}

// Async Worker for trajectory computation
class ComputeTrajectoryWorker : public Napi::AsyncWorker {
public:
    ComputeTrajectoryWorker(Napi::Function& callback, 
                           const std::vector<std::string>& inputFiles,
                           const std::string& outputTemplate)
        : Napi::AsyncWorker(callback), inputFiles(inputFiles), outputTemplate(outputTemplate) {}
        
    ~ComputeTrajectoryWorker() {}
    
    void Execute() override {
        try {
            if (inputFiles.empty()) {
                SetError("Input file list cannot be empty");
                return;
            }
            
            // Parse all LAMMPS files into frames
            std::vector<LammpsParser::Frame> frames;
            frames.reserve(inputFiles.size());
            LammpsParser parser;
            
            for (const auto& filePath : inputFiles) {
                if (!std::filesystem::exists(filePath)) {
                    SetError("Input file does not exist: " + filePath);
                    return;
                }
                
                LammpsParser::Frame frame;
                if (!parser.parseFile(filePath, frame)) {
                    SetError("Failed to parse input file: " + filePath);
                    return;
                }
                frames.push_back(std::move(frame));
            }
            
            // Run trajectory analysis with progress callback
            result = globalAnalyzer.compute(frames, outputTemplate, progressCallbackWrapper);
            
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }
    
    void OnOK() override {
        Napi::HandleScope scope(Env());
        
        // Convert JSON result to Napi::Object
        Napi::Object napiResult = Napi::Object::New(Env());
        
        for (auto& [key, value] : result.items()) {
            if (value.is_string()) {
                napiResult.Set(key, Napi::String::New(Env(), value.get<std::string>()));
            } else if (value.is_number_integer()) {
                napiResult.Set(key, Napi::Number::New(Env(), value.get<int>()));
            } else if (value.is_number_float()) {
                napiResult.Set(key, Napi::Number::New(Env(), value.get<double>()));
            } else if (value.is_boolean()) {
                napiResult.Set(key, Napi::Boolean::New(Env(), value.get<bool>()));
            } else if (value.is_array()) {
                Napi::Array arr = Napi::Array::New(Env());
                for (size_t i = 0; i < value.size(); i++) {
                    if (value[i].is_object()) {
                        Napi::Object frameObj = Napi::Object::New(Env());
                        for (auto& [frameKey, frameValue] : value[i].items()) {
                            if (frameValue.is_string()) {
                                frameObj.Set(frameKey, Napi::String::New(Env(), frameValue.get<std::string>()));
                            } else if (frameValue.is_number_integer()) {
                                frameObj.Set(frameKey, Napi::Number::New(Env(), frameValue.get<int>()));
                            } else if (frameValue.is_number_float()) {
                                frameObj.Set(frameKey, Napi::Number::New(Env(), frameValue.get<double>()));
                            } else if (frameValue.is_boolean()) {
                                frameObj.Set(frameKey, Napi::Boolean::New(Env(), frameValue.get<bool>()));
                            }
                        }
                        arr[i] = frameObj;
                    }
                }
                napiResult.Set(key, arr);
            }
        }
        
        Callback().Call({Env().Null(), napiResult});
    }
    
private:
    std::vector<std::string> inputFiles;
    std::string outputTemplate;
    json result;
};

// Set progress callback function
Napi::Value SetProgressCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Expected function argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    Napi::Function callback = info[0].As<Napi::Function>();
    
    // Create thread-safe function for progress callback
    globalProgressCallback = std::make_shared<Napi::ThreadSafeFunction>(
        Napi::ThreadSafeFunction::New(
            env,
            callback,
            "ProgressCallback",
            0, // Unlimited queue
            1  // Only one thread will use this
        )
    );
    
    return env.Undefined();
}

// Compute trajectory (async version)
Napi::Value ComputeTrajectory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Expected array of file paths and output template string").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Parse input file paths
    Napi::Array inputArray = info[0].As<Napi::Array>();
    std::vector<std::string> inputFiles;
    
    for (uint32_t i = 0; i < inputArray.Length(); i++) {
        Napi::Value val = inputArray[i];
        if (val.IsString()) {
            inputFiles.push_back(val.As<Napi::String>().Utf8Value());
        }
    }
    
    std::string outputTemplate = info[1].As<Napi::String>().Utf8Value();
    
    // Check if callback is provided for async operation
    if (info.Length() > 2 && info[2].IsFunction()) {
        Napi::Function callback = info[2].As<Napi::Function>();
        ComputeTrajectoryWorker* worker = new ComputeTrajectoryWorker(callback, inputFiles, outputTemplate);
        worker->Queue();
        return env.Undefined();
    }
    
    // Synchronous operation
    try {
        if (inputFiles.empty()) {
            throw std::invalid_argument("Input file list cannot be empty");
        }
        
        // Parse all files
        std::vector<LammpsParser::Frame> frames;
        frames.reserve(inputFiles.size());
        LammpsParser parser;
        
        for (const auto& filePath : inputFiles) {
            if (!std::filesystem::exists(filePath)) {
                throw std::runtime_error("Input file does not exist: " + filePath);
            }
            
            LammpsParser::Frame frame;
            if (!parser.parseFile(filePath, frame)) {
                throw std::runtime_error("Failed to parse input file: " + filePath);
            }
            frames.push_back(std::move(frame));
        }
        
        // Run analysis
        json result = globalAnalyzer.compute(frames, outputTemplate, progressCallbackWrapper);
        
        // Convert to Napi::Object
        Napi::Object napiResult = Napi::Object::New(env);
        
        for (auto& [key, value] : result.items()) {
            if (value.is_string()) {
                napiResult.Set(key, Napi::String::New(env, value.get<std::string>()));
            } else if (value.is_number_integer()) {
                napiResult.Set(key, Napi::Number::New(env, value.get<int>()));
            } else if (value.is_number_float()) {
                napiResult.Set(key, Napi::Number::New(env, value.get<double>()));
            } else if (value.is_boolean()) {
                napiResult.Set(key, Napi::Boolean::New(env, value.get<bool>()));
            } else if (value.is_array()) {
                // Handle frames array
                Napi::Array arr = Napi::Array::New(env);
                for (size_t i = 0; i < value.size(); i++) {
                    if (value[i].is_object()) {
                        Napi::Object frameObj = Napi::Object::New(env);
                        for (auto& [frameKey, frameValue] : value[i].items()) {
                            if (frameValue.is_string()) {
                                frameObj.Set(frameKey, Napi::String::New(env, frameValue.get<std::string>()));
                            } else if (frameValue.is_number_integer()) {
                                frameObj.Set(frameKey, Napi::Number::New(env, frameValue.get<int>()));
                            } else if (frameValue.is_number_float()) {
                                frameObj.Set(frameKey, Napi::Number::New(env, frameValue.get<double>()));
                            } else if (frameValue.is_boolean()) {
                                frameObj.Set(frameKey, Napi::Boolean::New(env, frameValue.get<bool>()));
                            }
                        }
                        arr[i] = frameObj;
                    }
                }
                napiResult.Set(key, arr);
            }
        }
        
        return napiResult;
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
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
    
    try {
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
        
        // Convert JSON to Napi::Object
        Napi::Object napiResult = Napi::Object::New(env);
        
        for (auto& [key, value] : result.items()){
            if(value.is_string()){
                napiResult.Set(key, Napi::String::New(env, value.get<std::string>()));
            }else if(value.is_number_integer()){
                napiResult.Set(key, Napi::Number::New(env, value.get<int>()));
            }else if(value.is_number_float()){
                napiResult.Set(key, Napi::Number::New(env, value.get<double>()));
            }else if(value.is_boolean()){
                napiResult.Set(key, Napi::Boolean::New(env, value.get<bool>()));
            }
        }
        
        return napiResult;
        
    }catch (const std::exception& e){
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

// Initialize the odule
Napi::Object Init(Napi::Env env, Napi::Object exports){
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
    
    return exports;
}

NODE_API_MODULE(opendxa_fixed, Init)