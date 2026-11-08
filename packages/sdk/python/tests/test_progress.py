from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import voltsdk.progress as progress


class ReportProgressTest(unittest.TestCase):
    def setUp(self) -> None:
        progress._last_written_at = None
        progress._last_fraction = None
        self.stream = io.StringIO()

    def lines(self) -> list[str]:
        return self.stream.getvalue().splitlines()

    def test_writes_done_of_total_as_a_fraction_with_its_text(self) -> None:
        progress.report_progress(340, 1000, "Meshing cells", stream=self.stream)
        self.assertEqual(self.lines(), ["@volt:progress 0.3400 Meshing cells"])

    def test_clamps_and_keeps_the_text_on_one_line(self) -> None:
        progress.report_progress(1.7, text="two\nlines", stream=self.stream)
        self.assertEqual(self.lines(), ["@volt:progress 1.0000 two lines"])

    def test_skips_lines_closer_together_than_shown_but_not_the_last(self) -> None:
        for index in range(1, 101):
            progress.report_progress(index, 100, stream=self.stream)
        self.assertEqual(self.lines(), ["@volt:progress 0.0100", "@volt:progress 1.0000"])

    def test_rejects_a_total_that_is_not_positive(self) -> None:
        with self.assertRaises(ValueError):
            progress.report_progress(1, 0, stream=self.stream)

    def test_status_is_its_own_directive(self) -> None:
        progress.report_status("Indexing neighbours", stream=self.stream)
        progress.report_status("   ", stream=self.stream)
        self.assertEqual(self.lines(), ["@volt:status Indexing neighbours"])

    def test_defaults_to_stderr(self) -> None:
        captured = io.StringIO()
        original = sys.stderr
        sys.stderr = captured
        try:
            progress.report_status("Writing results")
        finally:
            sys.stderr = original
        self.assertEqual(captured.getvalue(), "@volt:status Writing results\n")


if __name__ == "__main__":
    unittest.main()
