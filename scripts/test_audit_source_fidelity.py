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


    def test_nested_units_use_exact_item_refs_without_parent_fallback(self):
        lesson = {
            'id': 1,
            'sourceRef': 'book.pdf p.1 · lesson',
            'vocabulary': [{
                'id': 'v1', 'ko': '학생', 'targetText': '학생',
                'sourceRef': 'book.pdf p.1 · vocab-v1',
                'example': '학생입니다.',
                'exampleSourceRef': 'book.pdf p.1 · vocab-v1-example',
            }],
            'grammar': [{
                'id': 'g1', 'pattern': 'N입니다', 'sourceRef': 'book.pdf p.2 · grammar-g1',
                'examples': ['학생입니다.', '의사입니다.'],
                'exampleSourceRefs': ['book.pdf p.2 · grammar-g1-example-0'],
            }],
            'dialogues': [{
                'id': 'd1', 'sourceRef': 'book.pdf p.3 · dialogue', 'origin': 'source',
                'lines': [
                    {'ko': '안녕하세요', 'sourceRef': 'book.pdf p.3 · d1-line-0'},
                    {'ko': '안녕히 가세요'},
                ],
            }],
            'listening': [{
                'id': 'l1', 'text': '누구예요?', 'sourceRef': 'book.pdf p.4 · listening-l1',
            }],
            'reading': {
                'title': '읽기', 'titleSourceRef': 'book.pdf p.5 · reading-title',
                'text': '학생입니다.', 'textSourceRef': 'book.pdf p.5 · reading-text',
                'sourceRef': 'book.pdf p.5 · reading-container',
                'questions': [{'id': 'rq1', 'q': '누구예요?', 'sourceRef': None}],
            },
            'speaking': ['안녕하세요', '감사합니다'],
            'speakingSourceRefs': ['book.pdf p.6 · speaking-0'],
            'writing': {
                'prompt': '자기소개를 쓰세요.', 'sourceRef': 'book.pdf p.7 · writing-prompt',
                'targetWords': ['이름', '나이'],
                'targetWordSourceRefs': ['book.pdf p.7 · target-word-0'],
            },
            'pronunciation': [{
                'id': 'p1', 'title': '받침', 'explanation': '받침 발음 규칙',
                'sourceRef': 'book.pdf p.8 · pronunciation-rule',
                'examples': ['한국', '책'],
                'exampleSourceRefs': ['book.pdf p.8 · pronunciation-example-0'],
            }],
            'culture': [{'id': 'c1', 'title': '문화', 'text': '한국의 인사 문화', 'sourceRef': 'book.pdf p.9 · culture-c1'}],
            'extraSections': [{
                'id': 'x1', 'title': '연습 문제', 'sourceRef': 'book.pdf p.10 · section',
                'content': ['1번 문제', '2번 문제'],
                'contentSourceRefs': ['book.pdf p.10 · x1-item-0'],
            }],
        }
        rows = {(kind, item_id): (text, reference, origin)
                for kind, item_id, text, reference, origin in audit.units(lesson)}

        self.assertEqual(rows[('vocabulary', 'v1')][1], 'book.pdf p.1 · vocab-v1')
        self.assertEqual(rows[('vocabulary-example', 'v1:example')][1], 'book.pdf p.1 · vocab-v1-example')
        self.assertEqual(rows[('grammar-pattern', 'g1')][1], 'book.pdf p.2 · grammar-g1')
        self.assertEqual(rows[('grammar-example', 'g1:0')][1], 'book.pdf p.2 · grammar-g1-example-0')
        self.assertIsNone(rows[('grammar-example', 'g1:1')][1])
        self.assertEqual(rows[('dialogue-turn', 'd1:0')][1], 'book.pdf p.3 · d1-line-0')
        self.assertIsNone(rows[('dialogue-turn', 'd1:1')][1])
        self.assertIsNone(rows[('reading-question', 'rq1')][1])
        self.assertEqual(rows[('speaking-prompt', '0')][1], 'book.pdf p.6 · speaking-0')
        self.assertIsNone(rows[('speaking-prompt', '1')][1])
        self.assertIsNone(rows[('writing-target-word', 'writing:1')][1])
        self.assertIsNone(rows[('pronunciation-example', 'p1:1')][1])
        self.assertIsNone(rows[('extra-section-content', 'x1:1')][1])
        self.assertEqual(rows[('culture-text', 'c1')][1], 'book.pdf p.9 · culture-c1')


if __name__ == '__main__':
    unittest.main()
