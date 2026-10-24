"""Read-only citation audit. Literal matches are evidence, never semantic coverage.

Uses recovered pages only when their identity and SHA-256 match the original PDF.
Flags differences for human review; never repairs OCR or relabels content itself.
"""
import argparse
import hashlib
import json
import pathlib
import re
import unicodedata
from collections import Counter


def compact(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text) if c.isalnum())


def cited_pages(reference, file_name, page_count):
    if not reference:
        return []
    # Abbreviated legacy names are allowed only in a single-source course.
    named = re.findall(r'([^;·\n]+?\.pdf)', reference, flags=re.I)
    if named and any(name.strip().casefold() != file_name.casefold() and '...' not in name for name in named):
        return []
    result = []
    for match in re.finditer(r'\bpp?\.\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*)', reference, re.I):
        for part in match[1].split(','):
            ends = [int(v.strip()) for v in re.split('[-–—]', part)]
            start, end = ends[0], ends[-1]
            if not 1 <= start <= end <= page_count:
                return []
            result.extend(range(start, end + 1))
    return list(dict.fromkeys(result))


def _aligned_ref(refs, index):
    return refs[index] if isinstance(refs, list) and index < len(refs) else None


def units(lesson, questions=()):
    """Yield authored source-bearing items, keeping nested refs item-level.

    Parent section refs are deliberately not inherited by examples, dialogue
    turns, speaking prompts, reading questions, target words or exercise parts.
    """
    for item in lesson.get('vocabulary', []):
        item_id = str(item.get('id', ''))
        yield 'vocabulary', item_id, item.get('targetText') or item.get('ko'), item.get('sourceRef'), None
        example = item.get('example')
        if isinstance(example, str) and example.strip():
            yield 'vocabulary-example', item_id + ':example', example, item.get('exampleSourceRef'), None

    for item in lesson.get('grammar', []):
        item_id = str(item.get('id', ''))
        pattern = item.get('pattern')
        if isinstance(pattern, str) and pattern.strip():
            yield 'grammar-pattern', item_id, pattern, item.get('sourceRef'), None
        for index, example in enumerate(item.get('examples', [])):
            yield 'grammar-example', item_id + ':' + str(index), example, _aligned_ref(item.get('exampleSourceRefs'), index), None

    for item in lesson.get('dialogues', []):
        for index, line in enumerate(item.get('lines', [])):
            yield 'dialogue-turn', str(item.get('id', '')) + ':' + str(index), line.get('targetText') or line.get('ko'), line.get('sourceRef'), line.get('origin') or item.get('origin')

    for item in lesson.get('listening', []):
        yield 'listening', str(item.get('id', '')), item.get('text'), item.get('sourceRef'), None

    reading = lesson.get('reading')
    if reading:
        if reading.get('title'):
            yield 'reading-title', 'reading:title', reading.get('title'), reading.get('sourceRef'), None
        yield 'reading', 'reading', reading.get('text'), reading.get('sourceRef'), None
        for index, question in enumerate(reading.get('questions', [])):
            yield 'reading-question', str(question.get('id', index)), question.get('q'), question.get('sourceRef'), None

    speaking = lesson.get('speaking', [])
    if isinstance(speaking, str):
        # Legacy scalar speaking text has no provable item-level alignment.
        # Keep it as one unverified unit instead of treating every character
        # as a separate prompt (which could create a false literal match).
        if speaking.strip():
            yield 'speaking-unstructured', 'speaking', speaking, None, None
    elif isinstance(speaking, list):
        for index, prompt in enumerate(speaking):
            yield 'speaking-prompt', str(index), prompt, _aligned_ref(lesson.get('speakingSourceRefs'), index), None
    elif speaking is not None:
        yield 'speaking-invalid-shape', 'speaking', '', None, None

    writing = lesson.get('writing')
    if writing:
        if writing.get('prompt'):
            yield 'writing-prompt', 'writing:prompt', writing.get('prompt'), writing.get('sourceRef'), None
        for index, word in enumerate(writing.get('targetWords', [])):
            yield 'writing-target-word', 'writing:target:' + str(index), word, _aligned_ref(writing.get('targetWordSourceRefs'), index), None

    for item in lesson.get('pronunciation', []):
        item_id = str(item.get('id', ''))
        if item.get('title'):
            yield 'pronunciation-title', item_id + ':title', item.get('title'), item.get('sourceRef'), None
        for index, example in enumerate(item.get('examples', [])):
            yield 'pronunciation-example', item_id + ':' + str(index), example, _aligned_ref(item.get('exampleSourceRefs'), index), None

    for item in lesson.get('culture', []):
        item_id = str(item.get('id', ''))
        if item.get('title'):
            yield 'culture-title', item_id + ':title', item.get('title'), item.get('sourceRef'), None
        if item.get('text'):
            yield 'culture-text', item_id + ':text', item.get('text'), item.get('sourceRef'), None

    for item in lesson.get('extraSections', []):
        for index, content in enumerate(item.get('content', [])):
            yield 'exercise-part', str(item.get('id', '')) + ':' + str(index), content, _aligned_ref(item.get('contentSourceRefs'), index), None

    for question in questions or []:
        if question.get('lessonId') != lesson.get('id'):
            continue
        question_id = str(question.get('id', ''))
        reference = question.get('sourceRef')
        origin = question.get('origin')
        yield 'question-prompt', question_id + ':prompt', question.get('prompt'), reference, origin

        # For textbook-origin questions, audit the option text and answer key
        # too; checking only the prompt can miss rewritten choices/answers.
        if origin == 'source':
            choices = question.get('choices', [])
            if isinstance(choices, list):
                for index, choice in enumerate(choices):
                    if isinstance(choice, str) and choice.strip():
                        yield 'question-choice', question_id + ':choice:' + str(index), choice, reference, origin
                    else:
                        yield 'question-choice-invalid', question_id + ':choice:' + str(index), '', None, None
            elif isinstance(choices, str) and choices.strip():
                yield 'question-choices-invalid-shape', question_id + ':choices', choices, None, None

            answer = question.get('answer')
            if isinstance(answer, str) and answer.strip():
                yield 'question-answer', question_id + ':answer', answer, reference, origin


def audit(root):
    courses = []
    for file in sorted((root / 'courses').glob('*.json')):
        course = json.loads(file.read_text(encoding='utf-8'))
        source = course['source']
        file_name, job_id = source['fileName'], source['importJobId']
        if pathlib.Path(file_name).name != file_name or pathlib.Path(job_id).name != job_id or any(c in job_id + file_name for c in '\\/'):
            raise ValueError('Unsafe source identity')
        sha = hashlib.sha256((root / 'originals' / file_name).read_bytes()).hexdigest()
        cache = {}

        def page_text(number):
            if number not in cache:
                page_file = root / 'recovered-source' / job_id / f'{number:05d}.json'
                if not page_file.exists():
                    cache[number] = None
                else:
                    page = json.loads(page_file.read_text(encoding='utf-8'))
                    if page.get('sourceSha256') != sha or page.get('fileName') != file_name or page.get('pageNumber') != number:
                        raise ValueError('Recovered page does not match original: ' + str(number))
                    cache[number] = compact(page['text'])
            return cache[number]

        rows = []
        for lesson in course['lessons']:
            counts, issues = Counter(), []
            lesson_questions = [question for question in course.get('questions', []) if question.get('lessonId') == lesson.get('id')]
            for kind, item_id, text, reference, origin in units(lesson, lesson_questions):
                counts['checkedUnits'] += 1
                if origin == 'derived':
                    counts['explicitlyDerived'] += 1
                    continue
                pages = cited_pages(reference, file_name, source['pageCount'])
                texts = [page_text(n) for n in pages]
                candidate = compact(text)
                if kind == 'question-answer' and len(candidate) < 3:
                    # A one/two-character key (for example "A" or "1") is
                    # too weak for literal containment to prove fidelity.
                    status = 'requires-review'
                elif not candidate or not pages:
                    status = 'missing-citation'
                elif any(text is None for text in texts):
                    status = 'missing-page-evidence'
                elif any(candidate in text for text in texts):
                    counts['literalMatches'] += 1
                    continue
                else:
                    status = 'requires-review'
                counts[status] += 1
                # IDs and locations suffice; do not duplicate textbook contents in logs.
                issues.append({'kind': kind, 'id': item_id, 'pages': pages, 'status': status})
            rows.append({'lessonId': lesson['id'], 'counts': dict(counts), 'issues': issues})
        courses.append({'courseId': course['id'], 'sourceSha256': sha, 'lessons': rows})
    return {'version': 1, 'method': 'Authored target text -> cited original-page transcript; exact NFKC letter/number sequence, whitespace and punctuation ignored.', 'limits': ['Does not inventory missing source units or certify full curriculum coverage; this audit only checks authored items that already exist.', 'Does not verify Vietnamese meanings, grammar semantics, picture associations or answer keys. Translated/rewritten source items require human review.', 'Unmatched text may reflect OCR/layout errors, citation mistakes, paraphrases or unsupported content. Human PDF review required.'], 'courses': courses}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = audit(pathlib.Path(args.data_dir).resolve())
    output = pathlib.Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'courses': len(result['courses']), 'lessons': sum(len(c['lessons']) for c in result['courses']), 'counts': dict(sum((Counter(l['counts']) for c in result['courses'] for l in c['lessons']), Counter())), 'output': str(output)}))
