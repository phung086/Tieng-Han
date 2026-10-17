"""Recover source units from original local PDFs, without an AI key.

Private PDFs and extracted material stay outside Git. Writes require --apply,
retain timestamped backups, and never mark extraction as verified authorship.
Requires pdfplumber. OCR page records may be supplied in recovered-source/.
"""
import argparse
import copy
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


def clean(text):
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', text or '').strip()


def korean(text):
    return bool(re.search(r'[가-힣ㄱ-ㅣ]', text))


def join_words(words):
    return clean(' '.join(w['text'] for w in sorted(words, key=lambda w: w['x0'])))


def lines(words, tolerance=3):
    result = []
    for word in sorted(words, key=lambda w: (w['top'], w['x0'])):
        if result and abs(result[-1][0]['top']-word['top']) <= tolerance:
            result[-1].append(word)
        else:
            result.append([word])
    return result


def cell_pair(value):
    rows = [clean(x) for x in value.splitlines() if clean(x)]
    if len(rows)==1:
        inline=re.match(r'^([가-힣ㄱ-ㅣ0-9() /·.,?~-]+)\s+([A-Za-zÀ-ỹ].*)$',rows[0])
        if inline:return inline.group(1).strip(),inline.group(2).strip()
    if len(rows) < 2:
        return None
    split = next((i for i, row in enumerate(rows) if i and not korean(row)), None)
    if split is None:
        return None
    target, meaning = ' '.join(rows[:split]), ' '.join(rows[split:])
    if not korean(target) and not re.fullmatch(r'[A-Z][A-Z0-9 -]*', target):
        return None
    return target, meaning


def extract_vocabulary(page):
    """Read table cells and typography anchors; return unresolved cells too."""
    output, unresolved, table_boxes = [], [], []
    words = page.extract_words(x_tolerance=2, y_tolerance=3, extra_attrs=['size'])
    for table in page.find_tables():
        if table.bbox[1] < 50:
            continue  # decorative publisher masthead
        useful = False
        matrix=[]
        column_boxes={ci:box for row in table.rows for ci,box in enumerate(row.cells) if box is not None}
        for row in table.rows:
            cells=[]
            actual=[box for box in row.cells if box is not None]
            for ci,box in enumerate(row.cells):
                if box is None and ci in column_boxes and actual:
                    column=column_boxes[ci]
                    box=(column[0],min(b[1] for b in actual),column[2],max(b[3] for b in actual))
                if box is None:cells.append('');continue
                x0,y0,x1,y1=box
                selected=[w for w in words if x0-1 <= (w['x0']+w['x1'])/2 < x1+1 and y0-1 <= (w['top']+w['bottom'])/2 < y1+1]
                cells.append('\n'.join(join_words(r) for r in lines(selected)))
            matrix.append(cells)
        for row in matrix:
            for col,cell in enumerate(row):
                if not cell:
                    continue
                pair = cell_pair(cell)
                if pair:
                    output.append(pair)
                    useful = True
                elif korean(cell) and col+1<len(row) and not korean(row[col+1]) and re.search(r'[A-Za-zÀ-ỹ]',row[col+1]):
                    targets=cell.splitlines();meanings=row[col+1].splitlines()
                    if len(targets)==len(meanings):output.extend(zip(targets,meanings))
                    else:output.append((cell,row[col+1]))
                    useful=True
        # Some tables put Korean and Vietnamese on distinct successive rows.
        consumed=set()
        for col in range(max((len(row) for row in matrix),default=0)):
            pending=[]
            for ri,row in enumerate(matrix):
                cell=row[col] if col<len(row) else ''
                if not cell:continue
                if cell_pair(cell):pending=[];continue
                if korean(cell) and not re.search(r'[A-Za-zÀ-ỹ]',cell):pending.append((ri,cell))
                elif pending and not korean(cell) and re.search(r'[A-Za-zÀ-ỹ]',cell):
                    output.extend((target,cell) for _,target in pending)
                    consumed.update((pi,col) for pi,_ in pending);pending=[];useful=True
                else:pending=[]
        for ri,row in enumerate(matrix):
            for ci,cell in enumerate(row):
                if cell and korean(cell) and not cell_pair(cell) and (ri,ci) not in consumed:
                    if not(ci+1<len(row) and not korean(row[ci+1]) and re.search(r'[A-Za-zÀ-ỹ]',row[ci+1])):unresolved.append(cell)
        if useful:
            table_boxes.append(table.bbox)
    inside = lambda w: any(b[0]-1 <= w['x0'] and w['x1'] <= b[2]+1 and b[1]-1 <= w['top'] < b[3]+1 for b in table_boxes)
    anchors = [w for w in words if 10.4 <= w['size'] <= 12.5 and (korean(w['text']) or re.fullmatch(r'[A-Z][A-Z0-9]*|[\d()/?.,=~\-①-⑳]+',w['text'])) and not inside(w)]
    groups = []
    for row in lines(anchors):
        for word in sorted(row, key=lambda w: w['x0']):
            if groups and abs(groups[-1][-1]['top']-word['top']) < 3 and word['x0']-groups[-1][-1]['x1'] < 14:
                groups[-1].append(word)
            else:
                groups.append([word])
    for group in groups:
        left, right = group[0]['x0'], group[-1]['x1']
        top, bottom = min(w['top'] for w in group), max(w['bottom'] for w in group)
        peers = [g for g in groups if g is not group and abs(g[0]['top']-top) < 4 and g[0]['x0'] > right]
        limit_x = min((g[0]['x0'] for g in peers), default=float(page.width)-35)
        previous=[g for g in groups if g is not group and abs(g[0]['top']-top)<4 and g[-1]['x1']<left]
        center=(left+right)/2
        right_center=min(((g[0]['x0']+g[-1]['x1'])/2 for g in peers),default=2*float(page.width)-center)
        left_center=max(((g[0]['x0']+g[-1]['x1'])/2 for g in previous),default=-center)
        region_left=(left_center+center)/2;region_right=(right_center+center)/2
        next_row = min((g[0]['top'] for g in groups if g[0]['top'] > bottom+2 and region_left <= (g[0]['x0']+g[-1]['x1'])/2 < region_right), default=bottom+34)
        for marker in words:
            if marker['text'] in ['Lưu','▶'] and bottom < marker['top'] < next_row:next_row=marker['top']
        inline=any(w['size']<10.1 and not korean(w['text']) and abs(w['top']-top)<5 and right <= w['x0'] < limit_x for w in words)
        low=left-10 if inline else region_left
        high=limit_x if inline else region_right
        meanings = [w for w in words if w['size'] < 10.1 and not inside(w) and low <= (w['x0']+w['x1'])/2 < high and top-1 <= w['top'] < min(next_row-1, bottom+34) and not korean(w['text'])]
        # Inline labels may wrap, but must not absorb another complete labelled row.
        if inline:meanings=[w for w in meanings if w['top'] < top+18]
        meaning = ' '.join(join_words(row) for row in lines(meanings))
        target = join_words(group)
        if not korean(target) and not re.fullmatch(r'[A-Z][A-Z0-9]*',target):continue
        target=re.sub(r'^[①-⑳]\s*','',target)
        if meaning and re.search(r'[A-Za-zÀ-ỹ]', meaning):
            output.append((target, meaning))
        else:
            unresolved.append(target)
    # Identical entries on the same page are one word; meanings are not collapsed.
    targets={target for target,_ in output}
    return list(dict.fromkeys(output)), [x for x in dict.fromkeys(unresolved) if x not in targets]


def extract_dialogues(page):
    text=clean(page.extract_text(x_tolerance=2,y_tolerance=3) or '')
    output=[];current=[]
    def flush():
        if len(current)>1:output.append(list(current))
        current.clear()
    for row in text.splitlines():
        match=re.match(r'^([A-D]|[가-힣]{1,6})\s*[:：]?\s+(.+)',row)
        if match and korean(match.group(2)) and (re.match(r'^[A-D]\s',row) or ':' in row or '：' in row):
            content=match.group(2)
            # Bilingual columns contain a second Latin speaker label; preserve
            # the complete source in the fallback, keep Korean for shadowing.
            content=re.split(r'\s+[A-D]\s+(?=[A-Za-zÀ-ỹ])',content)[0]
            current.append({'speaker':match.group(1),'ko':content,'targetText':content})
        else:flush()
    flush()
    return output


def grammar_body(body_words):
    rows=lines(body_words)
    body=[join_words(row) for row in rows]
    examples=[]
    for row in rows:
        text=join_words(row)
        if korean(text) and sum(w['size']>=10.4 for w in row)>=max(1,len(row)//2) and re.search(r'[.?！!？]',text):
            target=[]
            for w in sorted(row,key=lambda w:w['x0']):
                if w['size']<10.3 and target:break
                target.append(w)
            example=join_words(target)
            if korean(example):examples.append(example)
    return body,list(dict.fromkeys(examples))


def grammar_prefix(page):
    words=page.extract_words(x_tolerance=2,y_tolerance=3,extra_attrs=['size'])
    first_heading=min((w['top'] for w in words if 12.6<=w['size']<=14.1 and korean(w['text'])),default=float(page.height)-40)
    return grammar_body([w for w in words if 45 < w['top'] < first_heading-1 and w['size']<12.6])


def grammar_blocks(page):
    words = page.extract_words(x_tolerance=2, y_tolerance=3, extra_attrs=['size'])
    headings = []
    for row in lines([w for w in words if 12.6 <= w['size'] <= 14.1]):
        title = join_words(row).lstrip('●• ').strip()
        if korean(title) and len(title) < 100:
            headings.append((min(w['top'] for w in row), title))
    headings.sort()
    output = []
    for i, (top, pattern) in enumerate(headings):
        end = headings[i+1][0] if i+1 < len(headings) else float(page.height)-40
        body_words = [w for w in words if top+8 <= w['top'] < end-1 and w['size'] < 12.6]
        body,examples=grammar_body(body_words)
        explanation = '\n'.join(body)
        first_example=next((i for i,text in enumerate(body) if text in examples),len(body))
        heading_words=[w for w in words if 12.6<=w['size']<=14.1 and abs(w['top']-top)<3]
        heading_right=max(w['x1'] for w in heading_words)
        gloss_words=[w for w in words if w['size']<10.3 and top-1<=w['top']<=top+7 and w['x0']>heading_right]
        gloss=join_words(gloss_words)
        meaning=gloss or ' '.join(body[:first_example])
        output.append({'pattern':pattern,'meaning':meaning or explanation,'explanation':explanation,'examples':list(dict.fromkeys(examples))})
    return output


def lesson_range(lesson):
    match = re.search(r'pp?\.\s*(\d+)\s*[-–]\s*(\d+)', lesson.get('sourceRef',''))
    if not match:
        raise ValueError('No explicit chapter range for lesson '+str(lesson['id']))
    start,end=map(int,match.groups())
    if start < 1 or end < start:
        raise ValueError('Invalid chapter range')
    return start,end


def task_blocks(text):
    """Preserve every character while exposing numbered original subparts."""
    text = clean(text)
    cuts = [m.start() for m in re.finditer(r'(?m)^(?:\(?\d+\)|\d+\.|[①-⑳])\s*', text)]
    points = sorted(set([0,*cuts,len(text)]))
    return [text[a:b].strip() for a,b in zip(points,points[1:]) if text[a:b].strip()]


def appendix_sections(pdf, lessons, first_page, name):
    """Read appendix columns independently so answers from adjacent lessons do not mix."""
    mapped={l['id']:[] for l in lessons}
    current=None
    unassigned=[]
    for n in range(first_page,len(pdf.pages)+1):
        page=pdf.pages[n-1]
        midpoint=float(page.width)/2
        for col,(left,right) in enumerate([(0,midpoint),(midpoint,float(page.width))],1):
            text=clean(page.crop((left,0,right,float(page.height))).extract_text() or '')
            rows=text.splitlines()
            cuts=[]
            for i,row in enumerate(rows):
                number=re.fullmatch(r'\s*(?:BÀI\s*)?(\d{1,2})\s*',row)
                workbook=re.match(r'\s*제\s*(\d+)\s*과',row)
                match=number or workbook
                if not match:continue
                lesson=next((l for l in lessons if l['id']==int(match.group(1))),None)
                if not lesson:continue
                following=' '.join(rows[i:i+3])
                title=re.sub(r'\s+','',lesson.get('title',''))
                if workbook or (title and title in re.sub(r'\s+','',following)):
                    cuts.append((i,lesson['id']))
            if re.search(r'^(?:Nội dung phần nghe|Đáp án|Văn hoá|Bảng từ mới)\b',text):
                current=None
            cursor=0
            chunks=[]
            for index,lesson_id in cuts:
                if index>cursor:chunks.append((current,'\n'.join(rows[cursor:index])))
                current=lesson_id;cursor=index
            chunks.append((current,'\n'.join(rows[cursor:])))
            for index,(lesson_id,content) in enumerate(chunks):
                if not clean(content):continue
                unit={'id':f'recovered:appendix:p{n}:c{col}:{index}','kind':'original-appendix','title':f'Phụ lục gốc · trang PDF {n} · cột {col}','content':[content],'sourceRef':f'{name} · p.{n} · cột {col}'}
                if lesson_id in mapped:mapped[lesson_id].append(unit)
                else:unassigned.append(unit)
        page.flush_cache()
    return mapped,unassigned


def atomic_json(file, value):
    temp=file.with_suffix(file.suffix+'.recover.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    os.replace(temp,file)


def compile_course(course, pdf, recovered_dir, expected_hash=None):
    result=copy.deepcopy(course)
    name=course['source']['fileName']
    report={'courseId':course['id'],'title':course['title'],'lessons':[],'status':'partial'}
    seen_pages=set()
    for lesson in result['lessons']:
        start,end=lesson_range(lesson)
        if end>len(pdf.pages):raise ValueError('Chapter outside source PDF')
        if any(n in seen_pages for n in range(start,end+1)):raise ValueError('Overlapping chapters')
        seen_pages.update(range(start,end+1))
        before={'vocabulary':len(lesson['vocabulary']),'grammar':len(lesson['grammar'])}
        extracted_words=[]; extracted_grammar=[]; issues=[]; source_pages=[]; extras=[];dialogues=[];pronunciation=[];culture=[]
        in_grammar=False
        in_vocabulary=False
        skill=''
        for n in range(start,end+1):
            page=pdf.pages[n-1]
            recovered_file=recovered_dir/f'{n:05}.json'
            p=json.loads(recovered_file.read_text(encoding='utf-8')) if recovered_file.exists() else None
            if p and expected_hash and (p.get('sourceSha256')!=expected_hash or p.get('pageNumber')!=n or p.get('fileName')!=name):
                raise ValueError(f'p.{n}: recovered page does not match the original PDF identity')
            raw=(p['text'] if p and not p.get('needsOcr') else page.extract_text(x_tolerance=2,y_tolerance=3) or '')
            text=clean(raw)
            ref=f'{name} · p.{n}'
            source_pages.append({'pageNumber':n,'textCharacters':len(text),'method':p.get('method') if p else 'pdfplumber','ocrConfidence':p.get('ocrConfidence') if p else None})
            if not text:
                issues.append(f'p.{n}: không có văn bản, phải đối chiếu ảnh gốc')
            # Complete text retained independently of structured units.
            extras.append({'id':f'recovered:p{n}:transcript','kind':'source-transcript','title':f'Bản trích xuất nguồn · trang PDF {n}','content':[text or 'Trang chưa có văn bản; mở ảnh nguồn để đối chiếu.'],'sourceRef':ref})
            if p and p.get('ocrConfidence') is not None:
                issues.append(f'p.{n}: OCR {p["ocrConfidence"]}%, chưa duyệt thủ công')
                extras.append({'id':f'recovered:p{n}:ocr','kind':'source-transcript','title':f'OCR cần đối chiếu · trang PDF {n}','content':task_blocks(text),'sourceRef':ref})
                continue  # OCR errors must not silently become answerable flashcards.
            header=text[:200]
            top_words=page.extract_words(extra_attrs=['size'])
            large=' '.join(w['text'] for w in top_words if w['size']>=17 and w['top']<float(page.height)*0.25)
            for marker,label in [('말하기','speaking'),('듣기','listening'),('읽기','reading'),('쓰기','writing'),('발음','pronunciation'),('문화','culture')]:
                if marker in large:skill=label
            is_grammar=bool(re.search(r'기본\s*문법',header))
            if is_grammar:in_grammar=True;in_vocabulary=False
            # Grammar may continue over multiple pages before the speaking section.
            if in_grammar and n>start+1 and re.search(r'알아봅시다|말하기|1\s+Nói',header):in_grammar=False
            if in_grammar:
                prefix,prefix_examples=grammar_prefix(page)
                if extracted_grammar and prefix:
                    extracted_grammar[-1]['explanation']+='\n'+'\n'.join(prefix)
                    extracted_grammar[-1]['examples'].extend(prefix_examples)
                    extracted_grammar[-1]['sourceRef']+=f', p.{n} · tiếp nối'
                blocks=grammar_blocks(page)
                for i,item in enumerate(blocks):
                    item.update(id=f'recovered:p{n}:grammar:{i+1}',sourceRef=ref+f' · ngữ pháp {i+1}')
                    extracted_grammar.append(item)
            if re.search(r'기본\s*어휘',header):in_vocabulary=True
            is_vocab=in_vocabulary or bool(re.search(r'새\s*단어',header))
            if is_vocab:
                pairs,unresolved=extract_vocabulary(page)
                for i,(target,meaning) in enumerate(pairs):
                    extracted_words.append({'id':f'recovered:p{n}:vocabulary:{i+1}','ko':target,'targetText':target,'vi':meaning,'learnerMeaning':meaning,'example':'','sourceRef':ref+f' · mục từ {i+1}'})
                issues.extend(f'p.{n}: cần đối chiếu ô/dòng từ vựng: {x}' for x in unresolved)
            # Actual exercises remain open-ended. No guessed grading or translations.
            if not is_vocab and not in_grammar and text:
                blocks=task_blocks(text)
                extras.append({'id':f'recovered:p{n}:activities','kind':'original-'+(skill or 'activities'),'title':f'Nội dung và hoạt động gốc · trang PDF {n}','content':blocks,'sourceRef':ref})
                if skill in ['speaking','listening','reading']:
                    for di,dialogue in enumerate(extract_dialogues(page)):
                        for li,line in enumerate(dialogue):line['sourceRef']=ref+f' · hội thoại {di+1} · lượt {li+1}'
                        dialogues.append({'id':f'recovered:p{n}:dialogue:{di+1}','title':f'Hội thoại gốc · trang PDF {n} · {di+1}','lines':dialogue,'sourceRef':ref})
                if skill=='pronunciation':pronunciation.append({'id':f'recovered:p{n}:pronunciation','title':f'Phát âm theo nguồn · trang PDF {n}','explanation':text,'examples':[],'sourceRef':ref})
                if skill=='culture':culture.append({'id':f'recovered:p{n}:culture','title':f'Văn hóa theo nguồn · trang PDF {n}','text':text,'sourceRef':ref})
            page.flush_cache()
        # Correct existing matching entries from the source and keep their IDs.
        # Distinct source glosses remain distinct; old unmatched entries stay for
        # review. Original values are retained in the transaction's full backup.
        normalize=lambda text:re.sub(r'\s+','',clean(text))
        existing=lesson['vocabulary'];used=set();canonical=[];seen_pairs=set();new_count=0
        for word in extracted_words:
            pair=(word['ko'],word['vi'])
            if pair in seen_pairs:continue
            seen_pairs.add(pair)
            matched=next((w for w in existing if normalize(w['ko'])==normalize(word['ko']) and w['id'] not in used),None)
            revised=copy.deepcopy(word)
            if matched:revised['id']=matched['id'];used.add(matched['id'])
            else:new_count+=1
            canonical.append(revised)
        canonical_targets={normalize(w['ko']) for w in canonical}
        leftovers=[w for w in existing if normalize(w['ko']) not in canonical_targets]
        by_id={w['id']:w for w in canonical}
        existing_ids={w['id'] for w in existing}
        if canonical:
            lesson['vocabulary']=[by_id.get(w['id'],w) for w in existing if w['id'] in by_id or normalize(w['ko']) not in canonical_targets]+[w for w in canonical if w['id'] not in existing_ids]
        else:lesson['vocabulary']=existing
        if extracted_grammar:
            # Source grammar is authoritative; previous content is in the backup.
            # Reuse IDs for exact matching patterns to retain learner identities.
            old={re.sub(r'\s+','',g['pattern']):g for g in lesson['grammar']}
            for item in extracted_grammar:
                previous=old.get(re.sub(r'\s+','',item['pattern']))
                if previous:item['id']=previous['id']
            lesson['grammar']=extracted_grammar
        else:
            issues.append('Chưa tách được ngữ pháp từ nguồn; giữ nguyên bản cũ để đối chiếu, không chứng nhận đủ.')
        lesson['extraSections']=[s for s in lesson.get('extraSections',[]) if not s['id'].startswith('recovered:')]+extras
        for key,entries in [('dialogues',dialogues),('pronunciation',pronunciation),('culture',culture)]:
            lesson[key]=[x for x in lesson.get(key,[]) if not x['id'].startswith('recovered:')]+entries
        lesson.pop('quality',None)  # Prior self-reported scores are not review evidence.
        lesson['sourceRecovery']={**lesson.get('sourceRecovery',{}),'status':'partial','pages':source_pages,'issues':issues,'independentlyVerified':False}
        report['lessons'].append({'lessonId':lesson['id'],'sourceRange':[start,end],'before':before,'after':{'vocabulary':len(lesson['vocabulary']),'grammar':len(lesson['grammar']),'grammarExamples':sum(len(g['examples']) for g in lesson['grammar'])},'newVocabulary':new_count,'recoveredVocabulary':len(canonical),'legacyVocabularyRetained':len(leftovers) if canonical else len(existing),'recoveredGrammar':len(extracted_grammar),'sourcePages':source_pages,'issues':issues})
    last_page=max(seen_pages)
    appendix,unassigned=appendix_sections(pdf,result['lessons'],last_page+1,name)
    for lesson in result['lessons']:
        lesson['extraSections'].extend(appendix[lesson['id']])
    # All appendix blocks remain retained, including review material whose lesson
    # cannot be established confidently. Do not invent a lesson assignment.
    result['source']['unassignedAppendix']=unassigned
    report['appendix']={'mappedBlocks':sum(len(v) for v in appendix.values()),'unassignedBlocks':len(unassigned),'requiresReview':True}
    coverage=result['source'].get('curriculumCoverage',{})
    coverage.update(status='partial',basis='Khôi phục toàn bộ phạm vi bài từ PDF gốc; tách theo bố cục. Chưa kiểm chứng độc lập mọi đơn vị.',issues=['Toàn bộ bài đã qua đối chiếu phạm vi nguồn; vẫn cần duyệt nghĩa, bố cục bảng, bài gốc, đáp án và OCR. Bản trích xuất không được tính là bài biên soạn hoàn tất.'])
    for kind in ['sourceCoverage','practiceCoverage','validationCoverage']:
        coverage[kind]={'covered':0,'total':0,'percent':None}
    result['source']['curriculumCoverage']=coverage
    return result,report


def main():
    import pdfplumber
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',required=True,type=Path)
    parser.add_argument('--original-dir',required=True,type=Path)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    root=args.data_dir.resolve()
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup=root/'review'/('source-recovery-'+stamp)
    backup.mkdir(parents=True,exist_ok=False)
    reports=[]; failures=[]
    for file in sorted((root/'courses').glob('*.json')):
        try:
            course=json.loads(file.read_text(encoding='utf-8'))
            original=(args.original_dir/course['source']['fileName']).resolve()
            if original.parent!=args.original_dir.resolve():raise ValueError('Invalid original file name')
            digest=hashlib.sha256(original.read_bytes()).hexdigest()
            archive=root/'recovered-source'/course['source']['importJobId']
            with pdfplumber.open(original) as pdf:
                if len(pdf.pages)!=course['source']['pageCount']:raise ValueError('Original page count differs from imported source')
                revised,report=compile_course(course,pdf,archive,digest)
            report.update(originalSha256=digest,applied=args.apply)
            atomic_json(backup/file.name,course)
            candidates=backup/'candidates'
            candidates.mkdir(exist_ok=True)
            atomic_json(candidates/file.name,revised)
            if args.apply:
                atomic_json(file,revised)
                active=root/'active-course.json'
                if active.exists() and json.loads(active.read_text(encoding='utf-8'))['id']==course['id']:
                    atomic_json(backup/'active-course.json',json.loads(active.read_text(encoding='utf-8')))
                    atomic_json(active,revised)
            reports.append(report)
            print(json.dumps({'courseId':course['id'],'lessons':len(report['lessons']),'newVocabulary':sum(l['newVocabulary'] for l in report['lessons']),'recoveredGrammar':sum(l['recoveredGrammar'] for l in report['lessons']),'applied':args.apply}),flush=True)
        except Exception as error:
            failures.append({'file':file.name,'error':str(error)})
            print(json.dumps(failures[-1]),flush=True)
    atomic_json(backup/'report.json',{'courses':reports,'failures':failures,'complete':False})
    print('REPORT',backup/'report.json',flush=True)
    if failures:raise SystemExit(1)


if __name__=='__main__':
    main()
