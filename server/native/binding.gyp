{
  "targets": [
    {
      "target_name": "stats_parser",
      "sources": ["src/stats_parser.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    }
  ]
}
