#ifndef OPENDXA_PYTHON_LOGGER_WRAPPER_HPP
#define OPENDXA_PYTHON_LOGGER_WRAPPER_HPP

#include <string>
#include <opendxa/logger/logger_manager.hpp>

namespace OpenDXA::Bindings::Python::Wrappers{

class LoggerWrapper{
public:
    LoggerWrapper();

    void setLevel(const std::string& level);
    void setLogFile(const std::string& filename);
    void enableConsole(bool enable);
    void enableTimestamp(bool enable);
    void enableThreadId(bool enable);

    void debug(const std::string& message);
    void info(const std::string& message);
    void warn(const std::string& message);
    void error(const std::string& message);
    void fatal(const std::string& message);

    bool hasFatalOccurred() const;
    void clearFatalFlag();

private:
    void ensureLoggerInitialized();
};

}

#endif