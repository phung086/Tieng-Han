"""Re-extract every original PDF page; optionally restore local source snapshots.

Dependencies: pdfplumber, pymupdf. No textbook files are checked into Git.
Run without --apply to stage recovery and render evidence without replacing data.
OCR sidecars remain explicitly unreviewed, even when confidence is high.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil


def atomic(file,value):
    temporary=file.with_suffix('.recovery.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
    os.replace(temporary,file)


def main():
    import pdfplumber
    import pymupdf
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',required=True,type=Path)
    parser.add_argument('--original-dir',required=True,type=Path)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    root=args.data_dir.resolve();original_dir=args.original_dir.resolve()
    backup=root/'review'/('page-recovery-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(parents=True)
    results=[];failures=[]
    for cf in sorted((root/'courses').glob('*.json')):
        try:
            course=json.loads(cf.read_text(encoding='utf-8'))
            name=course['source']['fileName'];job_id=course['source']['importJobId']
            original=(original_dir/name).resolve()
            if original.parent!=original_dir or Path(job_id).name!=job_id:raise ValueError('Invalid source identity')
            digest=hashlib.sha256(original.read_bytes()).hexdigest()
            archive=root/'recovered-source'/job_id;archive.mkdir(parents=True,exist_ok=True)
            job_dir=root/'import-jobs'/job_id
            job=json.loads((job_dir/'job.json').read_text(encoding='utf-8'))
            documents=[d for d in job['documents'] if d['fileName']==name]
            if len(documents)!=1:raise ValueError('Original file must identify exactly one imported document')
            document=documents[0]
            with pdfplumber.open(original) as pdf,pymupdf.open(original) as visual:
                if len(pdf.pages)!=document['pageCount']:raise ValueError('Original PDF page count differs')
                report={'courseId':course['id'],'fileName':name,'originalSha256':digest,'pages':[],'applied':args.apply}
                for index,page in enumerate(pdf.pages):
                    n=index+1;cached=archive/f'{n:05}.json'
                    if cached.exists():
                        recovered=json.loads(cached.read_text(encoding='utf-8'))
                        if recovered.get('sourceSha256')!=digest:raise ValueError(f'p.{n}: recovery belongs to a different original')
                    else:
                        text=page.extract_text(x_tolerance=2,y_tolerance=3) or ''
                        recovered={'fileName':name,'pageNumber':n,'sourceSha256':digest,'text':text,'width':float(page.width),'height':float(page.height),'words':page.extract_words(x_tolerance=2,y_tolerance=3,extra_attrs=['fontname','size']),'method':'pdfplumber','needsOcr':not text.strip()}
                        atomic(cached,recovered)
                    record={'pageNumber':n,'textCharacters':len(recovered['text']),'needsOcr':recovered['needsOcr'],'ocrConfidence':recovered.get('ocrConfidence'),'error':None}
                    try:
                        snapshot=job_dir/'pages'/f'{document["documentId"]}-{n:05}.json'
                        data=json.loads(snapshot.read_text(encoding='utf-8'))
                        # Render from the original PDF, retaining glyphs omitted by
                        # old browser snapshots. Scans retain their original image.
                        if not data.get('previewImageDataUrl') or '\x07' in data['text']:
                            image=visual[index].get_pixmap(matrix=pymupdf.Matrix(1.6,1.6)).tobytes('jpeg',jpg_quality=85)
                            data['previewImageDataUrl']='data:image/jpeg;base64,'+base64.b64encode(image).decode('ascii')
                        if not recovered['needsOcr']:
                            data['text']=recovered['text'].replace('\x07',' ').replace('\x01',' ')
                            data['extractionMethod']=recovered['method'];data['originalSha256']=digest
                            if recovered.get('ocrConfidence') is not None:
                                data['ocrConfidence']=recovered['ocrConfidence']
                                data['extractionIssues']=[f'OCR {recovered["ocrConfidence"]}%; cần đối chiếu ảnh gốc.']
                        if args.apply:
                            destination=backup/job_id/'pages';destination.mkdir(parents=True,exist_ok=True)
                            shutil.copy2(snapshot,destination/snapshot.name)
                            atomic(snapshot,data)
                    except Exception as error:
                        record['error']=str(error)
                    report['pages'].append(record)
                    page.flush_cache()
                    if n%50==0:print(json.dumps({'fileName':name,'page':n,'total':len(pdf.pages)}),flush=True)
                atomic(archive/'manifest.json',report)
                results.append(report)
        except Exception as error:
            failures.append({'file':cf.name,'error':str(error)})
    atomic(backup/'report.json',{'courses':results,'failures':failures,'independentlyVerified':False})
    print('REPORT',backup/'report.json',flush=True)
    if failures or any(p['error'] for c in results for p in c['pages']):raise SystemExit(1)


if __name__=='__main__':main()
