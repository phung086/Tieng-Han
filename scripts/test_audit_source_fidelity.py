import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('audit', pathlib.Path(__file__).with_name('audit-source-fidelity.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class CitationAuditTests(unittest.TestCase):
    def test_source_identity_and_bounds(self):
        self.assertEqual(audit.cited_pages('book.pdf pp.1-3, 5 · p.7', 'book.pdf', 10), [1, 2, 3, 5, 7])
        self.assertEqual(audit.cited_pages('other.pdf p.1', 'book.pdf', 10), [])
        self.assertEqual(audit.cited_pages('book.pdf p.11', 'book.pdf', 10), [])
        self.assertEqual(audit.cited_pages('book.pdf pp.3-1', 'book.pdf', 10), [])

    def test_spacing_control_and_compatibility_without_fuzzy_matching(self):
        self.assertEqual(audit.compact('학교에\x01 가요. ２'), audit.compact('학교에가요2'))
        self.assertNotEqual(audit.compact('학교에 가요'), audit.compact('학교에서 가요'))


if __name__ == '__main__':
    unittest.main()
