"""Create reviewable image/item bindings from original PDFs, never mutate courses.

Requires PyMuPDF, Pillow and opencv-python-headless. Run against private local
data: --data-dir PATH --output PATH. Inspect the contact sheets and candidates
before applying. Exact candidates require a unique caption and picture above it;
unlabelled pictures remain lesson context, never an answer to a picture quiz.
"""
import argparse, base64, hashlib, io, json, re, sys, unicodedata
from pathlib import Path
import pymupdf
import cv2
import numpy as np
from PIL import Image, ImageDraw

def norm(text):
    return re.sub(r'[^\w가-힣]', '', unicodedata.normalize('NFKC', text)).lower()

def referenced_pages(reference):
    result=[]
    for match in re.finditer(r'\bpp?\.\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*)',reference or ''):
        for part in match[1].split(','):
            numbers=re.split(r'[-–—]',part); first=int(numbers[0]); last=int(numbers[-1]);result.extend(range(first,last+1))
    return list(dict.fromkeys(result))

def caption_boxes(words,text):
    query=norm(text); matches=[]
    if not query: return []
    # Recovery arrays need not be in reading order. Group by baseline first.
    lines=[]
    for word in sorted(words,key=lambda w:(w['top'],w['x0'])):
        height=max(1,word['bottom']-word['top'])
        line=next((line for line in lines if abs(line[0]['top']-word['top'])<height*.45),None)
        if line is None: lines.append([word])
        else: line.append(word)
    for line in lines:
        line.sort(key=lambda w:w['x0'])
        for index in range(len(line)):
            for end in range(index+1,min(len(line),index+7)+1):
                part=line[index:end]; value=norm(''.join(w['text'] for w in part))
                if value==query:
                    matches.append((min(w['x0'] for w in part),min(w['top'] for w in part),max(w['x1'] for w in part),max(w['bottom'] for w in part)))
                if len(value)>len(query): break
    return list(dict.fromkeys(matches))

def page_pictures(page):
    width,height=page.rect.width,page.rect.height
    boxes=[tuple(info['bbox']) for info in page.get_image_info()]
    # Scanned pages have only one full-page raster: detect bounded color regions
    # in original pixels, preserving the crop coordinates for review.
    if any((b[2]-b[0])*(b[3]-b[1])>width*height*.8 for b in boxes):
        pix=page.get_pixmap(matrix=pymupdf.Matrix(1,1),alpha=False)
        array=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)[...,:3]
        hsv=cv2.cvtColor(array,cv2.COLOR_RGB2HSV)
        mask=np.where((hsv[:,:,1]>45)&(hsv[:,:,2]>45)&(hsv[:,:,2]<250),255,0).astype(np.uint8)
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
        for contour in cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]:
            x,y,w,h=cv2.boundingRect(contour)
            region=array[y:y+h,x:x+w]
            entropy=Image.fromarray(region).convert('L').entropy()
            occupied=float(np.mean(np.min(region,axis=2)<225))
            if w>width*.07 and h>height*.045 and w*h<width*height*.3 and entropy>5.5 and occupied>.45:
                boxes.append((x*width/pix.width,y*height/pix.height,(x+w)*width/pix.width,(y+h)*height/pix.height))
    return list(dict.fromkeys(b for b in boxes if b[1]>height*.09 and b[3]<height*.95 and b[2]-b[0]>width*.055 and b[3]-b[1]>height*.035 and (b[2]-b[0])*(b[3]-b[1])<width*height*.45))

def compile_course(course,root):
    job=course['source']['importJobId']; filename=course['source']['fileName']; pdf=pymupdf.open(root/'originals'/filename)
    cache={}; output=[]
    def source(number):
        if number not in cache:
            page=pdf[number-1]; recovery=root/'recovered-source'/job/f'{number:05}.json'
            data=json.loads(recovery.read_text('utf8')) if recovery.exists() else {'words':[], 'width':page.rect.width,'height':page.rect.height}
            # Normalize recovery coordinates; cropbox/media-box dimensions differ.
            # pdfplumber reports MediaBox positions; rendered pages use CropBox.
            # OCR, in contrast, uses the rendered bitmap coordinate system.
            ox=page.cropbox.x0 if data.get('method')=='pdfplumber' else 0
            oy=page.cropbox.y0 if data.get('method')=='pdfplumber' else 0
            rw=page.rect.width if data.get('method')=='pdfplumber' else data['width']
            rh=page.rect.height if data.get('method')=='pdfplumber' else data['height']
            words=[dict(w,x0=(w['x0']-ox)/rw,x1=(w['x1']-ox)/rw,top=(w['top']-oy)/rh,bottom=(w['bottom']-oy)/rh) for w in data['words']]
            pictures=[(a/page.rect.width,b/page.rect.height,c/page.rect.width,d/page.rect.height) for a,b,c,d in page_pictures(page)]
            cache[number]=(page,words,pictures)
        return cache[number]
    for lesson in course['lessons']:
        images=[]; used=set()
        def add(kind,targets,relation,number,box,label,caption):
            x0,y0,x1,y1=box; region=[round(max(0,x0),6),round(max(0,y0),6),round(min(1,x1)-max(0,x0),6),round(min(1,y1)-max(0,y0),6)]
            if region[2]<=0 or region[3]<=0 or region[2]*region[3]>=.8:return
            identity=f"{job}:{lesson['id']}:{kind}:{number}:{targets}:{region}"
            images.append({'id':'figure-'+hashlib.sha256(identity.encode()).hexdigest()[:20], 'kind':kind,'targetIds':targets,'relation':relation,'fileName':filename,'pageNumber':number,'region':region,'alt':label,'caption':caption,'sourceRef':f'{filename} · p.{number} · region {region}'})
        for word in lesson['vocabulary']:
            candidates=[]
            for number in referenced_pages(word.get('sourceRef')):
                if not 1<=number<=len(pdf):continue
                page,words,pictures=source(number)
                captions=caption_boxes(words,word.get('targetText') or word['ko'])
                # A unique exact caption is a necessary condition, never infer
                # a word from merely sharing a page with an arbitrary picture.
                for a,b,c,d in captions:
                    center=(a+c)/2
                    nearby=[box for box in pictures if box[0]-.01<=center<=box[2]+.01 and -.004<=b-box[3]<=.045 and .65<(box[2]-box[0])/max(c-a,.01)<15]
                    if len(nearby)==1:candidates.append((number,nearby[0]))
            candidates=list(dict.fromkeys(candidates))
            if len(candidates)==1:
                number,box=candidates[0];add('vocabulary',[word['id']],'exact',number,box,word.get('targetText') or word['ko'],'');used.add((number,box))
        # A picture below a matched grammar heading belongs to that grammar
        # section, ending before the next matched heading on the same page.
        headings={}
        for grammar in lesson['grammar']:
            for number in referenced_pages(grammar.get('sourceRef')):
                if not 1<=number<=len(pdf):continue
                _,words,_=source(number); boxes=caption_boxes(words,grammar['pattern'])
                if len(boxes)==1: headings.setdefault(number,[]).append((boxes[0][1],grammar))
        for number,items in headings.items():
            items.sort(key=lambda item:item[0]); _,_,pictures=source(number)
            for i,(top,grammar) in enumerate(items):
                end=items[i+1][0] if i+1<len(items) else .94
                for box in pictures:
                    if top<=box[1] and box[3]<end and (number,box) not in used:
                        add('grammar',[grammar['id']],'context',number,box,'Minh họa tình huống của mẫu '+grammar['pattern'],'Quan sát hình và đọc ví dụ của mẫu '+grammar['pattern']);used.add((number,box))
        # Preserve the remaining real visual assets as context inside the lesson.
        # They are not assigned to a particular word without a caption match.
        # Other pictures stay in the candidate inventory. Limit context binding
        # to a dialogue/reading source or the lesson's opening situation page.
        contextual=referenced_pages(lesson.get('sourceRef'))[:1]
        if not lesson.get('dialogues') and not lesson.get('reading'): contextual=referenced_pages(lesson.get('sourceRef'))
        contextual+=referenced_pages((lesson.get('reading') or {}).get('sourceRef'))
        for dialogue in lesson.get('dialogues',[]):contextual+=referenced_pages(dialogue.get('sourceRef'))
        for number in dict.fromkeys(contextual):
            if not 1<=number<=len(pdf):continue
            page,words,pictures=source(number)
            pictures=[box for box in pictures if (number,box) not in used and sum(box[0]<=w['x0'] and w['x1']<=box[2] and box[1]<=w['top'] and w['bottom']<=box[3] for w in words)<=8]
            groups=[]
            for picture in sorted(pictures,key=lambda b:b[1]):
                group=next((g for g in groups if picture[1]<=max(b[3] for b in g)+.035),None)
                if group is None: groups.append([picture])
                else:group.append(picture)
            for pictures in groups:
                # Composite PDF artwork may be dozens of masked raster tiles.
                # Keep its visual panel together, never publish tile fragments
                # or blank writing-frame borders as separate illustrations.
                box=(min(b[0] for b in pictures),min(b[1] for b in pictures),max(b[2] for b in pictures),max(b[3] for b in pictures))
                box=(max(0,box[0]),max(0,box[1]),min(1,box[2]),min(1,box[3]))
                if box[2]<=box[0] or box[3]<=box[1]:continue
                if (box[2]-box[0])*(box[3]-box[1])>.72:continue
                if sum(box[0]<=w['x0'] and w['x1']<=box[2] and box[1]<=w['top'] and w['bottom']<=box[3] for w in words)>20:continue
                clip=pymupdf.Rect(box[0]*page.rect.width,box[1]*page.rect.height,box[2]*page.rect.width,box[3]*page.rect.height)
                pix=page.get_pixmap(matrix=pymupdf.Matrix(1,1),clip=clip,alpha=False)
                if not pix.width or not pix.height:continue
                rgb=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)[...,:3];hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
                if float(np.mean(hsv[:,:,1]>45))<.025 and filename.lower().startswith('sách'):continue
                add('context',[],'context',number,box,'Hình tình huống trong bài '+str(lesson['id']),'Quan sát tình huống của bài học')
        output.append({'id':lesson['id'],'illustrations':images})
    return {'courseId':course['id'],'sourceSha256':hashlib.sha256((root/'originals'/filename).read_bytes()).hexdigest(),'lessons':output}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--data-dir',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True); candidates=[]; tiles=[]
    for file in sorted((args.data_dir/'courses').glob('*.json')):
        course=json.loads(file.read_text('utf8')); result=compile_course(course,args.data_dir); candidates.append(result)
        print(json.dumps({'courseId':course['id'],'lessons':len(result['lessons']),'images':sum(len(l['illustrations']) for l in result['lessons']),'exact':sum(i['relation']=='exact' for l in result['lessons'] for i in l['illustrations'])}),flush=True)
        for lesson in result['lessons']:
            for image in lesson['illustrations']:
                # Individual contact tile identity is also the review identity.
                snapshot=json.loads((args.data_dir/'import-jobs'/course['source']['importJobId']/'pages'/f"doc-0-{image['pageNumber']:05}.json").read_text('utf8'))
                original=Image.open(io.BytesIO(base64.b64decode(snapshot['previewImageDataUrl'].split(',')[1])))
                x,y,w,h=image['region']; crop=original.crop((int(x*original.width),int(y*original.height),int((x+w)*original.width),int((y+h)*original.height)))
                crop.thumbnail((150,112)); tile=Image.new('RGB',(180,154),'white');tile.paste(crop,((180-crop.width)//2,0)); draw=ImageDraw.Draw(tile);draw.text((4,115),f"{len(candidates)} L{lesson['id']} p{image['pageNumber']} {image['kind'][:3]}",fill='black');draw.text((4,130),image['id'][-12:],fill='black');tiles.append(tile)
    (args.output/'candidates.json').write_text(json.dumps({'version':1,'courses':candidates},ensure_ascii=False,indent=2),encoding='utf8')
    for start in range(0,len(tiles),100):
        subset=tiles[start:start+100]; sheet=Image.new('RGB',(1800,154*((len(subset)+9)//10)),'#ccc')
        for index,tile in enumerate(subset):sheet.paste(tile,((index%10)*180,(index//10)*154))
        sheet.save(args.output/f'contact-{start//100+1:02}.jpg')
    print(json.dumps({'total':len(tiles),'sheets':(len(tiles)+99)//100}),flush=True)
if __name__=='__main__':main()
