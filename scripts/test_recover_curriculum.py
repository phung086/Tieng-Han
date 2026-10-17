import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('recover-curriculum.py'))
recovery=importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


def word(text,x,y,size=11):
    return {'text':text,'x0':x,'x1':x+len(text)*6,'top':y,'bottom':y+size,'size':size}


class FakePage:
    width=600
    height=800
    def __init__(self,text='',words=None,tables=None):
        self.text=text;self.words=words or [];self.tables=tables or []
    def extract_text(self,**kwargs):return self.text
    def extract_words(self,**kwargs):return self.words
    def find_tables(self):return self.tables
    def flush_cache(self):pass
    def crop(self,box):return FakePage('')


class RecoveryTests(unittest.TestCase):
    def test_original_subparts_are_not_capped_or_dropped(self):
        source='Original directions\n'+'\n'.join(f'{i}. Original task {i}' for i in range(1,601))
        blocks=recovery.task_blocks(source)
        self.assertEqual(len(blocks),601)
        self.assertIn('600. Original task 600',blocks[-1])
        self.assertEqual('\n'.join(blocks),source)

    def test_bilingual_table_cells_include_wrapped_meanings_and_latin_terms(self):
        self.assertEqual(recovery.cell_pair('수업\ngiờ học\nbuổi học'),('수업','giờ học buổi học'))
        self.assertEqual(recovery.cell_pair('MT\ndã ngoại tập thể'),('MT','dã ngoại tập thể'))
        self.assertEqual(recovery.cell_pair('손님 khách'),('손님','khách'))
        self.assertIsNone(recovery.cell_pair('한국어'))

    def test_inline_meaning_does_not_absorb_next_label_or_notes(self):
        page=FakePage(words=[word('학교',60,100),word('trường',90,103,8),word('học',130,103,8),word('Lưu',60,123,8),word('ý',80,123,8),word('도서관',60,150),word('thư',100,153,8),word('viện',125,153,8)])
        pairs,_=recovery.extract_vocabulary(page)
        self.assertEqual(pairs,[('학교','trường học'),('도서관','thư viện')])

    def test_grammar_examples_and_full_explanation_are_retained(self):
        page=FakePage(words=[word('밖에',60,100,13),word('Chỉ',60,125,9),word('có',85,125,9),word('하나밖에',60,150),word('없어요.',115,150),word('만',60,200,13),word('Chỉ',60,225,9),word('하나만',60,250),word('있어요.',110,250)])
        blocks=recovery.grammar_blocks(page)
        self.assertEqual([g['pattern'] for g in blocks],['밖에','만'])
        self.assertEqual(blocks[0]['examples'],['하나밖에 없어요.'])
        self.assertNotIn('있어요.',blocks[0]['explanation'])

    def test_grammar_continuation_before_next_heading_is_not_lost(self):
        page=FakePage(words=[word('참',60,70),word('좋군요!',95,70),word('-는',60,160,13),word('Next',60,190,9)])
        prefix,examples=recovery.grammar_prefix(page)
        self.assertEqual(prefix,['참 좋군요!'])
        self.assertEqual(examples,['참 좋군요!'])
        self.assertEqual(recovery.grammar_blocks(page)[0]['pattern'],'-는')

    def test_inline_grammar_gloss_is_retained_instead_of_repeating_explanation(self):
        page=FakePage(words=[word('여기',60,100,13),word('đây',100,103,8),word('Đại',60,130,9),word('từ',85,130,9),word('여기입니다.',60,160)])
        item=recovery.grammar_blocks(page)[0]
        self.assertEqual(item['meaning'],'đây')
        self.assertIn('Đại từ',item['explanation'])

    def test_entire_library_is_processed_and_repeated_recovery_is_idempotent(self):
        lesson_count=61
        source={'id':'synthetic','title':'Synthetic','source':{'fileName':'synthetic.pdf'},'questions':[{'id':'keep-me','answer':'untouched'}],'lessons':[{'id':i,'title':'학교','sourceRef':f'synthetic.pdf pp.{i}-{i}','vocabulary':[],'grammar':[],'extraSections':[]} for i in range(1,lesson_count+1)]}
        pdf=type('Pdf',(),{'pages':[FakePage('1. Original exercise') for _ in range(lesson_count)]})()
        with tempfile.TemporaryDirectory() as folder:
            first,report=recovery.compile_course(source,pdf,Path(folder))
            second,_=recovery.compile_course(first,pdf,Path(folder))
        self.assertEqual(len(report['lessons']),lesson_count)
        self.assertEqual(first,second)
        self.assertEqual(first['questions'],source['questions'])
        self.assertEqual(first['source']['curriculumCoverage']['status'],'partial')
        self.assertTrue(all(any(s['kind']=='original-activities' for s in l['extraSections']) for l in first['lessons']))
        self.assertEqual(source['lessons'][0]['extraSections'],[])

    def test_ocr_is_quarantined_and_never_becomes_verified_flashcards(self):
        source={'id':'s','title':'s','source':{'fileName':'s.pdf'},'lessons':[{'id':1,'sourceRef':'s.pdf pp.1-1','vocabulary':[],'grammar':[]}],'questions':[]}
        pdf=type('Pdf',(),{'pages':[FakePage('')]})()
        with tempfile.TemporaryDirectory() as folder:
            Path(folder,'00001.json').write_text(json.dumps({'text':'1. OCR text','method':'ocr','ocrConfidence':99,'needsOcr':False}),encoding='utf-8')
            revised,_=recovery.compile_course(source,pdf,Path(folder))
        lesson=revised['lessons'][0]
        self.assertEqual(lesson['vocabulary'],[])
        self.assertFalse(lesson['sourceRecovery']['independentlyVerified'])
        self.assertTrue(any('OCR 99%' in issue for issue in lesson['sourceRecovery']['issues']))
        self.assertTrue(all(s['kind']=='source-transcript' for s in lesson['extraSections']))

    def test_invalid_or_overlapping_ranges_fail_instead_of_dropping_lessons(self):
        source={'id':'s','title':'s','source':{'fileName':'s.pdf'},'lessons':[{'id':i,'sourceRef':'s.pdf pp.1-1','vocabulary':[],'grammar':[]} for i in [1,2]]}
        pdf=type('Pdf',(),{'pages':[FakePage('source')]})()
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError,'Overlapping'):
                recovery.compile_course(source,pdf,Path(folder))
        with self.assertRaises(ValueError):recovery.lesson_range({'id':1,'sourceRef':'unknown'})


if __name__=='__main__':unittest.main()
