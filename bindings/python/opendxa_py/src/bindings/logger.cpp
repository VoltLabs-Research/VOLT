#include <opendxa_py/bindings/logger.hpp>
#include <opendxa_py/wrappers/logger.hpp>

namespace py = pybind11;

namespace OpenDXA::Bindings::Python{

void bindLogger(py::module& m){
    py::class_<Wrappers::LoggerWrapper>(m, "Logger", "Logger instance for Python")
        .def(py::init<>(), "Create a logger instance")
        .def("set_level", &Wrappers::LoggerWrapper::setLevel, 
             "Set log level", py::arg("level"))
        .def("set_log_file", &Wrappers::LoggerWrapper::setLogFile, 
             "Set log file", py::arg("filename"))
        .def("enable_console", &Wrappers::LoggerWrapper::enableConsole, 
             "Enable console output", py::arg("enable"))
        .def("enable_timestamp", &Wrappers::LoggerWrapper::enableTimestamp, 
             "Enable timestamps", py::arg("enable"))
        .def("enable_thread_id", &Wrappers::LoggerWrapper::enableThreadId, 
             "Enable thread ID", py::arg("enable"))
        .def("debug", &Wrappers::LoggerWrapper::debug, 
             "Log debug message", py::arg("message"))
        .def("info", &Wrappers::LoggerWrapper::info, 
             "Log info message", py::arg("message"))
        .def("warn", &Wrappers::LoggerWrapper::warn, 
             "Log warning message", py::arg("message"))
        .def("error", &Wrappers::LoggerWrapper::error, 
             "Log error message", py::arg("message"))
        .def("fatal", &Wrappers::LoggerWrapper::fatal, 
             "Log fatal message", py::arg("message"))
        .def("has_fatal_occurred", &Wrappers::LoggerWrapper::hasFatalOccurred, 
             "Check if fatal error occurred")
        .def("clear_fatal_flag", &Wrappers::LoggerWrapper::clearFatalFlag, 
             "Clear fatal error flag");
}

}