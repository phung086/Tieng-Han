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


def units(lesson):
    for item in lesson['vocabulary']:
        yield 'vocabulary', item['id'], item.get('targetText') or item['ko'], item.get('sourceRef'), None
    for item in lesson['grammar']:
        for index, example in enumerate(item['examples']):
            yield 'grammar-example', item['id'] + ':' + str(index), example, item.get('sourceRef'), None
    for item in lesson.get('dialogues', []):
        for index, line in enumerate(item['lines']):
            yield 'dialogue-turn', item['id'] + ':' + str(index), line.get('targetText') or line['ko'], line.get('sourceRef') or item.get('sourceRef'), item.get('origin')
    for item in lesson['listening']:
        yield 'listening', item['id'], item['text'], item.get('sourceRef'), None
    if lesson.get('reading'):
        item = lesson['reading']
        yield 'reading', 'reading', item['text'], item.get('sourceRef'), None


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
            for kind, item_id, text, reference, origin in units(lesson):
                counts['checkedUnits'] += 1
                if origin == 'derived':
                    counts['explicitlyDerived'] += 1
                    continue
                pages = cited_pages(reference, file_name, source['pageCount'])
                texts = [page_text(n) for n in pages]
                candidate = compact(text)
                if not candidate or not pages:
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
    return {'version': 1, 'method': 'Authored target text -> cited original-page transcript; exact NFKC letter/number sequence, whitespace and punctuation ignored.', 'limits': ['Does not inventory missing source units or certify full curriculum coverage.', 'Does not verify Vietnamese meanings, grammar semantics, picture associations or answer keys.', 'Unmatched text may reflect OCR/layout errors, citation mistakes, paraphrases or unsupported content. Human PDF review required.'], 'courses': courses}


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
