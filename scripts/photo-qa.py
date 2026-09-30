from pathlib import Path
from PIL import Image
import hashlib,json
from pypdf.generic import ContentStream

def verify_photo(root,run,config):
    if not config.get('photo'):return None
    assert config.get('directHtml'),'Only direct HTML output is supported'
    record=config['directPhoto'];photo=run/record['path'];data=photo.read_bytes()
    sources=json.loads((run/'source-files.json').read_text())
    assert hashlib.sha256(data).hexdigest()==sources[record['path']],'Direct HTML photo snapshot identity mismatch'
    image=Image.open(photo);icc=image.info.get('icc_profile');assert icc,'Expected original photo ICC'
    result={'sourcePath':record['path'],'sourceSha256':hashlib.sha256(data).hexdigest(),'size':image.size,'iccSha256':hashlib.sha256(icc).hexdigest(),'sourceAndIccPreserved':True}
    geometry=json.loads((run/'screen-geometry.json').read_text());placed=next(n for n in geometry['nodes'] if n['tag']=='IMG' and n['objectFit']=='cover')
    ppi=96/max(placed['w']/image.width,placed['h']/image.height)
    result['effectivePpi']=round(ppi,2);result['workingTargetPpi']=240;result['meetsWorkingTarget']=ppi>=240
    result['resolutionGuidance']='Around 240 ppi at final placed size; below is a warning, not a block.'
    if ppi<240:result['warning']=f'Photo is {ppi:.2f} ppi at final placed size, below the around-240-ppi guide; inspect sharpness before use. Export is not blocked.'
    if config['composition']=='C1':
        result['padding']={}
        for name,pad in json.loads((run/'padding.json').read_text()).items():
            source=pad['source'];px,py=pad['paddingXY']
            src=Image.open(run/source);padded=Image.open(run/(name+'-padded.png'));a=src.convert('RGBA');b=padded.convert('RGBA');assert b.size==(a.width+2*px,a.height+2*py)
            assert b.crop((px,py,px+a.width,py+a.height)).tobytes()==a.tobytes()
            aa=a.load();bb=b.load()
            for y in range(b.height):
                for x in range(b.width):
                    if x<px or x>=px+a.width or y<py or y>=py+a.height:assert bb[x,y]==aa[min(a.width-1,max(0,x-px)),min(a.height-1,max(0,y-py))],'Padding differs from edge clamp'
            assert src.info.get('icc_profile')==padded.info.get('icc_profile')
            result['padding'][name]={'rectangleIdentical':True,'allPaddingEdgeClamped':True,'iccPreserved':True,'size':b.size}
    return result

def image_paints(reader,page):
    images=[]
    def multiply(a,b):
        x,y,z,w,u,v=a;A,B,C,D,E,F=b
        return (x*A+z*B,y*A+w*B,x*C+z*D,y*C+w*D,x*E+z*F+u,y*E+w*F+v)
    def walk(stream,resources,ctm=(1,0,0,1,0,0)):
        stack=[]
        for args,op in ContentStream(stream,reader).operations:
            if op==b'q':stack.append(ctm)
            elif op==b'Q':ctm=stack.pop()
            elif op==b'cm':ctm=multiply(ctm,tuple(float(x) for x in args))
            elif op==b'Do':
                obj=resources['/XObject'][args[0]].get_object()
                if obj.get('/Subtype')=='/Form':walk(obj,obj.get('/Resources',resources),multiply(ctm,tuple(float(x) for x in obj.get('/Matrix',[1,0,0,1,0,0]))))
                elif obj.get('/Subtype')=='/Image':
                    a,b,c,d,e,f=ctm
                    assert abs(b)+abs(c)<1e-6,'Rotated image not supported'
                    images.append({'width':int(obj['/Width']),'height':int(obj['/Height']),'iccBased':str(obj.get('/ColorSpace','')).startswith("['/ICCBased'"),'boundsPt':[min(e,e+a),min(f,f+d),max(e,e+a),max(f,f+d)]})
    walk(page['/Contents'],page['/Resources']);return images
