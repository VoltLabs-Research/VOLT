#include <opendxa_py/wrappers/logger.hpp>
#include <opendxa_py/utils/common.hpp>

namespace OpenDXA::Bindings::Python::Wrappers{

LoggerWrapper::LogerWrapper(){
    ensureLoggerInitialized();
}

void LoggerWrapper::ensureLoggerInitialized(){
    if(!LoggerManager::isInitialized()){
        LoggerManager::initialize("Global");
    }
}

void LoggerWrapper::setLevel(const std::string& level){
    LoggerManager::get().setLevel(utils::stringToLogLevel(level));
}

void LoggerWrapper::setLogFile(const std::string& filename){
    LoggerManager::get().setLogToFile(filename);
}

void LoggerWrapper::enableConsole(bool enable){
    LoggerManager::get().setLogToConsole(enable);
}

void LoggerWrapper::enableTimestamp(bool enable){
    LoggerManager::get().enableTimestamp(enable);
}

void LoggerWrapper::enableThreadId(bool enable){
    LoggerManager::get().enableThreadId(enable);
}

void LoggerWrapper::debug(const std::string& message){
    LOG_DEBUG() << message;
}

void LoggerWrapper::info(const std::string& message){
    LOG_INFO() << message;
}

void LoggerWrapper::warn(const std::string& message){
    LOG_WARN() << message;
}

void LoggerWrapper::error(const std::string& message){
    LOG_ERROR() << message;
}

void LoggerWrapper::fatal(const std::string& message){
    LOG_FATAL() << message;
}

bool LoggerWrapper::hasFatalOccurred() const{
    return LoggerManager::get().hasFatalOccurred();
}

void LoggerWrapper::clearFatalFlag(){
    LoggerManager::get().clearFatalFlag();
}

}