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


    def test_audits_all_existing_source_bearing_lesson_sections(self):
        lesson = {
            'id': 1,
            'vocabulary': [{'id': 'v1', 'ko': '학교', 'example': '학교에 가요', 'sourceRef': 'book.pdf p.1'}],
            'grammar': [{'id': 'g1', 'pattern': '-에 가요', 'examples': ['학교에 가요'], 'sourceRef': 'book.pdf p.1'}],
            'dialogues': [{'id': 'd1', 'origin': 'source', 'sourceRef': 'book.pdf p.1', 'lines': [{'ko': '안녕하세요'}]}],
            'listening': [{'id': 'l1', 'text': '학생입니다', 'sourceRef': 'book.pdf p.1'}],
            'reading': {'title': '읽기', 'text': '학생입니다', 'sourceRef': 'book.pdf p.1', 'questions': [{'id': 'rq1', 'q': '누구입니까', 'sourceRef': 'book.pdf p.1'}]},
            'speaking': ['안녕하세요'],
            'writing': {'prompt': '학교에 가요', 'sourceRef': 'book.pdf p.1', 'targetWords': ['학교']},
            'pronunciation': [{'id': 'p1', 'title': '발음', 'sourceRef': 'book.pdf p.1', 'examples': ['학교']}],
            'culture': [{'id': 'c1', 'title': '문화', 'text': '한국', 'sourceRef': 'book.pdf p.1'}],
            'extraSections': [{'id': 'e1', 'kind': 'exercise', 'content': ['이름을 쓰세요.'], 'sourceRef': 'book.pdf p.1'}],
        }
        questions = [{'id': 'q1', 'lessonId': 1, 'prompt': '학교에 가요', 'sourceRef': 'book.pdf p.1', 'origin': 'source'}]
        rows = list(audit.units(lesson, questions))
        kinds = {row[0] for row in rows}
        self.assertTrue({
            'vocabulary', 'vocabulary-example', 'grammar-pattern', 'grammar-example',
            'dialogue-turn', 'listening', 'reading-title', 'reading', 'reading-question',
            'speaking-prompt', 'writing-prompt', 'writing-target-word',
            'pronunciation-title', 'pronunciation-example', 'culture-title',
            'culture-text', 'exercise-part', 'question-prompt',
        }.issubset(kinds))

    def test_nested_items_do_not_inherit_parent_section_source_refs(self):
        lesson = {
            'id': 1,
            'vocabulary': [{'id': 'v1', 'ko': '학교', 'example': '학교에 가요', 'sourceRef': 'book.pdf p.1'}],
            'grammar': [{'id': 'g1', 'pattern': '-에 가요', 'examples': ['학교에 가요'], 'sourceRef': 'book.pdf p.1'}],
            'dialogues': [{'id': 'd1', 'sourceRef': 'book.pdf p.1', 'lines': [{'ko': '안녕하세요'}]}],
            'speaking': ['안녕하세요'],
            'writing': {'targetWords': ['학교'], 'sourceRef': 'book.pdf p.1'},
            'pronunciation': [{'id': 'p1', 'sourceRef': 'book.pdf p.1', 'examples': ['학교']}],
            'extraSections': [{'id': 'e1', 'sourceRef': 'book.pdf p.1', 'content': ['이름을 쓰세요.']}],
        }
        refs = {(kind, item_id): reference for kind, item_id, _text, reference, _origin in audit.units(lesson)}
        for key in [
            ('vocabulary-example', 'v1:example'), ('grammar-example', 'g1:0'),
            ('dialogue-turn', 'd1:0'), ('speaking-prompt', '0'),
            ('writing-target-word', 'writing:target:0'), ('pronunciation-example', 'p1:0'),
            ('exercise-part', 'e1:0'),
        ]:
            self.assertIsNone(refs[key], key)


    def test_scalar_speaking_is_one_unverified_item_not_characters(self):
        lesson = {
            'id': 1,
            'speaking': '안녕하세요',
            'speakingSourceRefs': ['book.pdf p.1'],
        }
        rows = [row for row in audit.units(lesson) if row[0].startswith('speaking')]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'speaking-unstructured')
        self.assertEqual(rows[0][2], '안녕하세요')
        self.assertIsNone(rows[0][3])

    def test_source_question_choices_and_answer_are_audited(self):
        lesson = {'id': 1}
        questions = [{
            'id': 'q1',
            'lessonId': 1,
            'origin': 'source',
            'prompt': '어디에 갑니까?',
            'choices': ['학교에 갑니다', '집에 갑니다'],
            'answer': '학교에 갑니다',
            'sourceRef': 'book.pdf p.1',
        }]
        rows = list(audit.units(lesson, questions))
        choices = [row for row in rows if row[0] == 'question-choice']
        self.assertEqual([row[2] for row in choices], ['학교에 갑니다', '집에 갑니다'])
        answer = next(row for row in rows if row[0] == 'question-answer')
        self.assertEqual(answer[2], '학교에 갑니다')
        self.assertEqual(answer[3], 'book.pdf p.1')

    def test_short_answer_key_is_never_claimed_as_literal_match(self):
        lesson = {'id': 1}
        questions = [{
            'id': 'q1',
            'lessonId': 1,
            'origin': 'source',
            'prompt': '정답은?',
            'choices': [],
            'answer': '1',
            'sourceRef': 'book.pdf p.1',
        }]
        rows = list(audit.units(lesson, questions))
        answer = next(row for row in rows if row[0] == 'question-answer')
        self.assertEqual(len(audit.compact(answer[2])), 1)


if __name__ == '__main__':
    unittest.main()
