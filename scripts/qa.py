import sys,json,re,math,hashlib,subprocess,io
sys.dont_write_bytecode=True
import importlib.metadata
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from pypdf import PdfReader
from pypdf.generic import ContentStream,ByteStringObject,TextStringObject
from fontTools.ttLib import TTFont
import importlib.util
spec=importlib.util.spec_from_file_location('photo_qa',Path(__file__).with_name('photo-qa.py'));photo_qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo_qa)

ROOT=Path(__file__).resolve().parents[1]
run=Path(sys.argv[1]).resolve()
assert run.is_relative_to(ROOT/'output')
# Read painted PDF rectangles because Chromium rounds background fills separately
# from fractional CSS text/layout coordinates. This preserves strict pixel checks.
def rectangles(reader,page):
    fills=[]
    def multiply(a,b):
        x,y,z,w,u,v=a;A,B,C,D,E,F=b
        return (x*A+z*B,y*A+w*B,x*C+z*D,y*C+w*D,x*E+z*F+u,y*E+w*F+v)
    def walk(stream,resources,ctm=(1,0,0,1,0,0),color=(0,0,0)):
        stack=[];rects=[]
        for args,op in ContentStream(stream,reader).operations:
            if op==b'q':stack.append((ctm,color))
            elif op==b'Q':ctm,color=stack.pop()
            elif op==b'cm':ctm=multiply(ctm,tuple(float(v) for v in args))
            elif op==b'rg':color=tuple(round(float(v)*255) for v in args)
            elif op==b'g':color=(round(float(args[0])*255),)*3
            elif op==b're':
                x,y,w,h=map(float,args);a,b,c,d,e,f=ctm
                if abs(b)+abs(c)>1e-8:raise ValueError('Rotated rectangle not supported')
                xx=sorted([a*x+e,a*(x+w)+e]);yy=sorted([d*y+f,d*(y+h)+f]);rects.append((*xx,*yy))
            elif op in [b'f',b'f*']:
                fills.extend({'color':color,'x1':r[0],'x2':r[1],'y1':r[2],'y2':r[3]} for r in rects);rects=[]
            elif op in [b'n',b'S',b's',b'B',b'B*',b'b',b'b*',b'm',b'l',b'c']:rects=[]
            elif op==b'Do':
                obj=resources['/XObject'][args[0]].get_object()
                if obj.get('/Subtype')=='/Form':walk(obj,obj.get('/Resources',resources),multiply(ctm,tuple(float(x) for x in obj.get('/Matrix',[1,0,0,1,0,0]))),color)
    walk(page['/Contents'],page['/Resources'])
    return fills


config=json.loads((run/'composition.json').read_text());composition=config['composition'];W,H=config['width']*10,config['height']*10;AW,AH=W+100,H+100
lock=json.loads((ROOT/'toolchain.json').read_text())
assert sys.version.split()[0]==lock['python']
for name,version in [('pypdf','6.10.0'),('Pillow','12.3.0'),('fonttools','4.60.1')]:
    dist=importlib.metadata.distribution(name)
    assert dist.version==version and Path(dist.locate_file('')).resolve().is_relative_to(ROOT/'.venv'),'Python dependency mismatch/outside package'
poppler=ROOT/lock['popplerPath'];assert poppler.resolve().is_relative_to(ROOT)
assert hashlib.sha256(poppler.read_bytes()).hexdigest()==lock['popplerSha256']
mm=lambda x:x*72/25.4
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
norm=lambda s:re.sub(r'\s+','',s).casefold()

def unicode_map(font):
    raw=font['/ToUnicode'].get_object().get_data().decode('ascii');mapping={}
    for section in re.findall(r'beginbfchar(.*?)endbfchar',raw,re.S):
        for a,b in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',section):mapping[int(a,16)]=bytes.fromhex(b).decode('utf-16-be')
    for section in re.findall(r'beginbfrange(.*?)endbfrange',raw,re.S):
        for line in section.strip().splitlines():
            tokens=re.findall(r'<([0-9A-Fa-f]+)>',line)
            if not tokens:continue
            a,b=int(tokens[0],16),int(tokens[1],16)
            if '[' in line:
                assert len(tokens[2:])==b-a+1
                for code,value in zip(range(a,b+1),tokens[2:]):mapping[code]=bytes.fromhex(value).decode('utf-16-be')
            else:
                assert len(tokens)==3
                base=int(tokens[2],16);width=len(tokens[2])//2
                for code in range(a,b+1):mapping[code]=(base+code-a).to_bytes(width,'big').decode('utf-16-be')
    assert mapping,'Missing usable ToUnicode'
    return mapping

def used_fonts(reader,page):
    used={}
    def walk(stream,resources,stack=(),current=None):
        for args,op in ContentStream(stream,reader).operations:
            if op==b'Tf':current=resources['/Font'][args[0]].get_object()
            elif op==b'Do':
                obj=resources['/XObject'][args[0]].get_object()
                if obj.get('/Subtype')=='/Form':
                    assert id(obj) not in stack,'Cyclic Form'
                    walk(obj,obj.get('/Resources',resources),stack+(id(obj),),current)
            elif op in [b'Tj',b'TJ',b"'",b'"']:
                assert current is not None
                values=args[0] if op==b'TJ' else [args[-1]]
                for val in values:
                    if isinstance(val,(ByteStringObject,TextStringObject)):
                        raw=val.original_bytes if isinstance(val,TextStringObject) else bytes(val)
                        step=2 if current.get('/Subtype')=='/Type0' else 1
                        assert len(raw)%step==0
                        key=id(current);entry=used.setdefault(key,[current,set(),{}])
                        for i in range(0,len(raw),step):
                            code=int.from_bytes(raw[i:i+step],'big');entry[1].add(code);entry[2][code]=entry[2].get(code,0)+1
    walk(page['/Contents'],page['/Resources'])
    result=[]
    for font,codes,counts in used.values():
        cmap=unicode_map(font);assert codes<=cmap.keys(),'Used character missing from ToUnicode'
        if font['/Subtype']=='/Type0':
            assert font['/Encoding']=='/Identity-H'
            child=font['/DescendantFonts'][0].get_object();assert child['/Subtype']=='/CIDFontType2'
            fd=child['/FontDescriptor'].get_object();data=fd['/FontFile2'].get_object().get_data();tt=TTFont(io.BytesIO(data));order=tt.getGlyphOrder();mapping=child.get('/CIDToGIDMap','/Identity')
            gm=mapping.get_object().get_data() if mapping!='/Identity' else None
            for code in codes:
                assert gm is None or 2*code+2<=len(gm),'CID mapping missing'
                gid=int.from_bytes(gm[2*code:2*code+2],'big') if gm is not None else code
                assert 0<gid<len(order),'Used glyph absent'
                glyph=tt['glyf'][order[gid]]
                assert cmap[code].isspace() or glyph.numberOfContours!=0,'Used visible glyph empty'
            result.append({'font':str(child['/BaseFont']),'usedCodes':sorted(codes),'embeddedSha256':hashlib.sha256(data).hexdigest(),'glyphCoverage':True})
        elif font['/Subtype']=='/Type3':
            encoding={};index=0
            for value in font['/Encoding']['/Differences']:
                if isinstance(value,int):index=value
                else:encoding[index]=str(value);index+=1
            programs={}
            for code in codes:
                assert code in encoding and encoding[code] in font['/CharProcs'],'Used Type3 glyph missing'
                stream=font['/CharProcs'][encoding[code]].get_object();data=stream.get_data();assert data
                ops=[op.decode() for args,op in ContentStream(stream,reader).operations]
                assert set(ops)<=set(['d1','m','l','c','h','f','f*','re']) and 'd1' in ops and ('f' in ops or 'f*' in ops),'Non-self-contained or empty Type3 glyph program'
                assert cmap[code]=='✳','Unexpected system fallback glyph'
                programs[str(code)]={'glyph':encoding[code],'calls':counts[code],'operators':sorted(set(ops)),'sha256':hashlib.sha256(data).hexdigest()}
            result.append({'font':str(font['/FontDescriptor']['/FontName']),'type':'Type3','usedPrograms':programs,'selfContained':True,'portability':'System fallback is not redistributed or portable-approved'})
        else:
            # Other font classes must receive equivalent used-code coverage before support.
            raise AssertionError('Unsupported font class for this C2 checkpoint: '+str(font['/Subtype']))
    assert result
    return result

g=json.loads((run/'screen-geometry.json').read_text())
bandColor='rgb(240, 196, 100)' if composition in ['C3','C4'] else 'rgb(2, 83, 214)'
footer=next((x for x in g['nodes'] if x['background']==bandColor and x['tag']=='DIV'),None) if composition!='C1' else None
top=(5*96/25.4+footer['y'])*254/96 if footer else None
bottom=top+footer['h']*254/96 if footer else None
report={'pass':False,'pdf':{},'boundaries':{},'comparison':{},'photo':photo_qa.verify_photo(ROOT,run,config)}
for name,offset in [('raw',0),('no-marks',0),('marks',100)]:
    p=run/(name+'.pdf');reader=PdfReader(p);assert len(reader.pages)==1;page=reader.pages[0]
    fonts=used_fonts(reader,page)
    paints=photo_qa.image_paints(reader,page);hasQR=json.loads((run/'input.json').read_text()).get('qr') is not None if (run/'input.json').exists() else bool(config.get('qr'))
    expectedImages=(2 if composition=='C1' else 1 if config.get('photo') else 0)+int(hasQR)
    assert len(paints)==expectedImages,'Unexpected/missing/duplicate image paints'
    if config.get('photo'):assert paints[0]['iccBased'],'Photographic PDF image must have an ICC colour space'
    if composition=='C1':
        if config.get('measuredPhoto'):
            # Chromium may remove off-page image rows/columns. Require an exact
            # pixel crop of each padded source, including gradient alpha.
            embedded=[x.image.convert('RGBA') for x in page.images]
            cropEvidence={}
            for asset in ['photo','gradient']:
                src=Image.open(run/(asset+'-padded.png')).convert('RGBA');match=None
                for image in embedded:
                    if image.width>src.width or image.height>src.height:continue
                    needle=image.crop((0,0,image.width,1)).tobytes();expectedBytes=image.tobytes()
                    for y in range(src.height-image.height+1):
                        row=src.crop((0,y,src.width,y+1)).tobytes();offsetX=row.find(needle)
                        while offsetX>=0:
                            x=offsetX//4
                            if offsetX%4==0 and src.crop((x,y,x+image.width,y+image.height)).tobytes()==expectedBytes:match={'cropXY':[x,y],'size':image.size,'pixelsIdentical':True};break
                            offsetX=row.find(needle,offsetX+4)
                        if match:break
                    if match:break
                assert match,'Embedded image is not an exact source crop: '+asset
                pad=json.loads((run/'padding.json').read_text())[asset];css=pad['paintCSS'];sx=css['size'][0]/pad['paddedSize'][0];sy=css['size'][1]/pad['paddedSize'][1]
                expected=[css['position'][0]+match['cropXY'][0]*sx,css['position'][1]+match['cropXY'][1]*sy,match['size'][0]*sx,match['size'][1]*sy]
                paint=next(i for i in paints if (i['width'],i['height'])==match['size']);x1,y1,x2,y2=paint['boundsPt'];slug=10 if name=='marks' else 0
                actual=[(x1-mm(slug))*96/72,(float(page.mediabox.top)-y2-mm(slug))*96/72,(x2-x1)*96/72,(y2-y1)*96/72]
                # Chromium quantises cropped PDF image bounds at the CSS pixel grid.
                assert max(abs(a-b) for a,b in zip(actual,expected))<1,('Photo placement changed',asset,actual,expected)
                match['paintPlacement']={'expectedCSS':expected,'actualCSS':actual,'maximumErrorCSS':max(abs(a-b) for a,b in zip(actual,expected))}
                cropEvidence[asset]=match
            report.setdefault('embeddedSourceCrops',{})[name]=cropEvidence
        else:assert sorted((i['width'],i['height']) for i in paints)==sorted([(975,1286),(18,1958)]+([(600,600)] if hasQR else [])),'C1 single photo/gradient paint mapping changed'
    if name!='raw':
        slug=10 if name=='marks' else 0
        w,h=config['width'],config['height'];expected={'mediabox':[0,0,mm(w+10+2*slug),mm(h+10+2*slug)],'cropbox':[0,0,mm(w+10+2*slug),mm(h+10+2*slug)],'bleedbox':[mm(slug),mm(slug),mm(w+10+slug),mm(h+10+slug)],'trimbox':[mm(slug+5),mm(slug+5),mm(slug+5+w),mm(slug+5+h)]}
        assert all(abs(float(getattr(page,k)[i])-v[i])<.001 for k,v in expected.items() for i in range(4))
    text=page.extract_text();(run/(name+'-text.txt')).write_text(text)
    assert all(norm(x['text']) in norm(text) for x in g['ranges']),'Missing source text'
    subprocess.run([str(poppler),'-r','254','-png','-singlefile',str(p),str(run/(name+'-full'))],check=True)
    im=Image.open(run/(name+'-full.png')).convert('RGB');regions={}
    if composition=='C1':
        accepted=Image.open(run/'bleed-preview-expanded.png' if config.get('measuredPhoto') else ROOT/config['acceptedFull']).convert('RGB')
        for key,box in [('top',(0,0,AW,50)),('bottom',(0,AH-51,AW,AH)),('left',(0,50,51,AH-50)),('right',(AW-51,50,AW,AH-50))]:
            crop=im.crop(tuple(v+offset for v in box));delta=ImageChops.difference(crop,accepted.crop(box));
            if config.get('measuredPhoto'):
                # Browser/PDF rasterisers interpolate image edges differently.
                # Placement and all source pixels are checked separately above.
                # Record raster interpolation differences without treating them as a pixel oracle.
                maximum=max(v[1] for v in delta.getextrema());mean=sum(ImageStat.Stat(delta).mean)/3
                regions[key]={'measuredHTMLComparison':True,'maximumChannelDelta':maximum,'meanChannelDelta':mean,'pixels':crop.width*crop.height}
            else:
                assert delta.getbbox() is None,(name,key,'Photo bleed differs from accepted proof');regions[key]={'matchesAcceptedPhotographicBleed':True,'pixels':crop.width*crop.height}
    else:
        ground={'C2':(255,255,255),'C3':(2,83,214),'C4':(17,17,17),'C5':(240,196,100)}[composition];band=(240,196,100) if composition in ['C3','C4'] else (2,83,214)
        if footer:
            slug=10 if name=='marks' else 0
            fills=[r for r in rectangles(reader,page) if r['color']==band and r['x1']<=mm(slug)+.001 and r['x2']>=mm(slug+config['width']+10)-.001]
            assert len(fills)==1,'Expected one full-bleed PDF footer fill'
            fill=fills[0]
            top=(float(page.mediabox.top)-fill['y2'])*254/72-offset
            bottom=(float(page.mediabox.top)-fill['y1'])*254/72-offset
            report.setdefault('paintedBands',{})[name]={'rectanglePt':fill,'rasterTop':top,'rasterBottom':bottom,'source':'PDF content stream, including Form transforms'}
        ticker=composition=='C5'
        end=math.floor(bottom) if ticker and footer else AH
        checks=[('top',(0,0,AW,50),ground),('bottom',(0,AH-51,AW,AH),ground if ticker or not footer else band)]
        for side,x1,x2 in [('left',0,51),('right',AW-51,AW)]:
            if footer:
                checks.extend([(side+'-ground',(x1,50,x2,math.floor(top)),ground),(side+'-band',(x1,math.ceil(top)+1,x2,end),band)])
                if ticker:checks.append((side+'-ticker',(x1,math.ceil(bottom)+1,x2,AH),ground))
            else:checks.append((side+'-ground',(x1,50,x2,AH),ground))
        for key,box,color in checks:
            crop=im.crop(tuple(v+offset for v in box));bad=sum(px!=color for px in crop.get_flattened_data());assert bad==0,(name,key,bad);regions[key]={'pixels':crop.width*crop.height,'badPixels':bad}
        for transition in ([top,bottom] if ticker and footer else [top] if footer else []):
            for y in range(math.floor(transition)-2,math.ceil(transition)+3):assert len(set(im.crop((offset,y+offset,AW+offset,y+offset+1)).get_flattened_data()))==1,'Transition seam'
    report['boundaries'][name]=regions
    if name!='raw':im.crop((50+offset,50+offset,50+W+offset,50+H+offset)).save(run/(name+'-trim.png'))
    report['pdf'][name]={'sha256':sha(p),'pages':1,'fonts':fonts,'imagePaints':paints,'rasterDimensions':im.size,'boxes':{k:[float(x) for x in getattr(page,k)] for k in ['mediabox','cropbox','bleedbox','trimbox']}}
a=Image.open(run/'no-marks-trim.png').convert('RGB');b=Image.open(run/'marks-trim.png').convert('RGB');assert ImageChops.difference(a,b).getbbox() is None
assert (run/'no-marks-text.txt').read_text()==(run/'marks-text.txt').read_text()
ref=Image.open(run/'preview-expanded.png').convert('RGB').crop((0,0,W,H));ref.save(run/'preview-trim.png')
board=Image.new('RGB',(2*W,H));board.paste(ref,(0,0));board.paste(a,(W,0));board.save(run/'preview-final-comparison.png')
def difference_stats(delta):
    channels=delta.split();nonzero=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2]);hist=nonzero.histogram()
    return {'changedPixels':delta.width*delta.height-hist[0],'meanChannelDelta':sum(ImageStat.Stat(delta).mean)/3}
diff=ImageChops.difference(a,ref);report['comparison']['previewDifference']=difference_stats(diff)
full=Image.open(run/'no-marks-full.png')
views={'top-left':(0,0,100,100),'top-right':(AW-100,0,AW,100),'bottom-left':(0,AH-100,100,AH),'bottom-right':(AW-100,AH-100,AW,AH)}
for name,y in ([('transition',top),('ticker',bottom)] if composition=='C5' and top is not None else [('transition',top)] if top is not None else []):views.update({name+'-left':(0,math.floor(y)-40,100,math.floor(y)+40),name+'-right':(AW-100,math.floor(y)-40,AW,math.floor(y)+40)})
for key,box in views.items():
    crop=full.crop(box);crop.resize((crop.width*4,crop.height*4),Image.Resampling.NEAREST).save(run/(key+'.png'))
report['comparison']['trimPixelIdentical']=True
report['qr']=json.loads(subprocess.check_output([lock['nodeCommand'],str(ROOT/'scripts/qr-check.mjs'),str(run)],text=True))
report['pass']=True
(run/'qa.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pass':True,'run':run.name}))
