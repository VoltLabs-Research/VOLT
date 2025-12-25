#pragma once

#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/core/lammps_parser.h>

#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include <map>
#include <memory>
#include <algorithm>
#include <optional>
#include <cstdlib>
#include <cctype>

#include <tbb/info.h>
#include <tbb/global_control.h>
#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_sinks.h>
#include <omp.h>

namespace OpenDXA::CLI {

using json = nlohmann::json;

inline void initLogging(const std::string& toolName = "OpenDXA", int threads = -1) {
    auto console_sink = std::make_shared<spdlog::sinks::stdout_sink_mt>();
    console_sink->set_level(spdlog::level::debug);
    auto logger = std::make_shared<spdlog::logger>(toolName, console_sink);
    logger->set_level(spdlog::level::debug);
    spdlog::set_default_logger(logger);
    spdlog::flush_on(spdlog::level::debug);
    spdlog::set_pattern("[%Y-%m-%d %H:%M:%S] [%l] %v");
    
    int n = threads > 0 ? threads : oneapi::tbb::info::default_concurrency();
    spdlog::info("Using {} threads (OneTBB)", n);
}

inline std::map<std::string, std::string> parseArgs(
    int argc, char* argv[],
    std::string& filename,
    std::string& outputBase
){
    std::map<std::string, std::string> options;
    
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.rfind("--", 0) == 0) {
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                options[arg] = argv[++i];
            } else {
                options[arg] = "true";
            }
        } else if (filename.empty()) {
            filename = arg;
        } else if (outputBase.empty()) {
            outputBase = arg;
        }
    }
    
    return options;
}

inline std::string deriveOutputBase(const std::string& filename, const std::string& outputBase) {
    if (!outputBase.empty()) {
        return outputBase;
    }
    std::filesystem::path inputPath(filename);
    return (inputPath.parent_path() / inputPath.stem()).string();
}

inline bool parseFrame(const std::string& filename, LammpsParser::Frame& frame) {
    spdlog::info("Parsing LAMMPS file: {}", filename);
    LammpsParser parser;
    if (!parser.parseFile(filename, frame)) {
        spdlog::error("Failed to parse LAMMPS file: {}", filename);
        return false;
    }
    spdlog::info("Successfully loaded {} atoms from the file.", frame.natoms);
    return true;
}

inline bool getBool(const std::map<std::string, std::string>& opts, const std::string& key, bool defaultVal = false) {
    auto it = opts.find(key);
    if (it == opts.end()) return defaultVal;
    return it->second == "true" || it->second == "1";
}

inline std::optional<bool> getOptionalBool(const std::map<std::string, std::string>& opts, const std::string& key) {
    auto it = opts.find(key);
    if (it == opts.end()) return std::nullopt;
    std::string value = it->second;
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c){
        return static_cast<char>(std::tolower(c));
    });
    if (value == "true" || value == "1" || value == "yes" || value == "on") return true;
    return false;
}

inline double getDouble(const std::map<std::string, std::string>& opts, const std::string& key, double defaultVal = 0.0) {
    auto it = opts.find(key);
    if (it == opts.end()) return defaultVal;
    try { return std::stod(it->second); }
    catch (...) { return defaultVal; }
}

inline int getInt(const std::map<std::string, std::string>& opts, const std::string& key, int defaultVal = 0) {
    auto it = opts.find(key);
    if (it == opts.end()) return defaultVal;
    try { return std::stoi(it->second); }
    catch (...) { return defaultVal; }
}

inline std::string getString(const std::map<std::string, std::string>& opts, const std::string& key, const std::string& defaultVal = "") {
    auto it = opts.find(key);
    return (it == opts.end()) ? defaultVal : it->second;
}

inline bool hasOption(const std::map<std::string, std::string>& opts, const std::string& key) {
    return opts.find(key) != opts.end();
}

inline bool getEnvBool(const char* name) {
    const char* value = std::getenv(name);
    if (!value) return false;
    std::string text = value;
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c){
        return static_cast<char>(std::tolower(c));
    });
    return text == "1" || text == "true" || text == "yes" || text == "on";
}

inline int getEnvInt(const char* name) {
    const char* value = std::getenv(name);
    if (!value) return 0;
    try { return std::stoi(value); }
    catch (...) { return 0; }
}

struct ParallelConfig {
    int threads = 1;
    bool deterministic = true;
    std::unique_ptr<oneapi::tbb::global_control> tbbControl;
};

inline ParallelConfig initParallelism(const std::map<std::string, std::string>& opts, bool deterministicDefault = false) {
    auto deterministicOpt = getOptionalBool(opts, "--deterministic");
    bool deterministicEnv = getEnvBool("OPENDXA_DETERMINISTIC");

    auto resolveThreads = [&](int fallback) {
        int threads = 0;
        if (hasOption(opts, "--threads")) {
            threads = getInt(opts, "--threads", 0);
        }
        if (threads <= 0) {
            threads = getEnvInt("OPENDXA_THREADS");
        }
        if (threads <= 0) {
            threads = fallback;
        }
        return threads;
    };

    int threads = 0;
    if (deterministicOpt.has_value()) {
        if (*deterministicOpt) {
            threads = 1;
        } else {
            threads = resolveThreads(oneapi::tbb::info::default_concurrency());
        }
    } else if (deterministicEnv) {
        threads = 1;
    } else {
        int fallback = deterministicDefault ? 1 : oneapi::tbb::info::default_concurrency();
        threads = resolveThreads(fallback);
    }

    threads = std::max(1, threads);
    bool deterministic = (threads == 1);

    omp_set_dynamic(0);
    omp_set_num_threads(threads);
    auto tbbControl = std::make_unique<oneapi::tbb::global_control>(
        oneapi::tbb::global_control::max_allowed_parallelism, threads);

    return {threads, deterministic, std::move(tbbControl)};
}

inline LatticeStructureType parseCrystalStructure(const std::string& val) {
    if (val == "FCC") return LATTICE_FCC;
    if (val == "HCP") return LATTICE_HCP;
    if (val == "CUBIC_DIAMOND") return LATTICE_CUBIC_DIAMOND;
    if (val == "HEX_DIAMOND") return LATTICE_HEX_DIAMOND;
    if (val == "SC") return LATTICE_SC;
    return LATTICE_BCC;  // default
}

inline StructureAnalysis::Mode parseIdentificationMode(const std::string& val) {
    if (val == "PTM") return StructureAnalysis::Mode::PTM;
    if (val == "DIAMOND") return StructureAnalysis::Mode::DIAMOND;
    return StructureAnalysis::Mode::CNA;
}

inline void printUsageHeader(const std::string& name, const std::string& description) {
    std::cerr << "\n" << description << "\n\n"
              << "Usage: " << name << " <lammps_file> [output_base] [options]\n\n"
              << "Arguments:\n"
              << "  <lammps_file>    Path to the LAMMPS dump file.\n"
              << "  [output_base]    Base path for output files (default: derived from input).\n\n"
              << "Options:\n";
}

inline void printHelpOption() {
    std::cerr << "  --help           Show this help message and exit.\n\n";
}

}
