from pathlib import Path
import sys,json,hashlib,math
from PIL import Image
root=Path(sys.argv[1]).resolve()
if not root.is_relative_to(Path(__file__).resolve().parents[1]/'output'):raise ValueError('Run must be local')
config=json.loads((root/'composition.json').read_text())
layout=json.loads((root/'photo-layout.json').read_text()) if config.get('measuredPhoto') else None
record={};styles={};bleed=5*96/25.4
for index,(name,source,pads) in enumerate([('photo','photos/climber.png',(32,32)),('gradient','gradient-a6.png',(1,48))]):
    if layout:
        item=layout['images'][index];p=(root/item['path']).resolve()
        if not p.is_relative_to(root/'assets'):raise ValueError('Photo must be a run asset')
    else:p=root/'assets'/source
    original=Image.open(p);profile=original.info.get('icc_profile');im=original.convert('RGBA');px,py=pads
    if layout:
        fw,fh=layout['width'],layout['height']
        if name=='photo':
            sx=sy=max(fw/im.width,fh/im.height);pos=[float(v.rstrip('%'))/100 for v in item['position'].split()]
            if len(pos)!=2 or any(v<0 or v>1 for v in pos):raise ValueError('Expected percentage photo position')
            ox=(fw-im.width*sx)*pos[0];oy=(fh-im.height*sy)*pos[1]
        else:sx=fw/im.width;sy=fh/im.height;ox=oy=0
        px=max(px,math.ceil(bleed/sx)+1);py=max(py,math.ceil(bleed/sy)+1)
        styles[name]={'size':[ (im.width+2*px)*sx,(im.height+2*py)*sy ],'position':[bleed+ox-px*sx,bleed+oy-py*sy]}
    out=Image.new('RGBA',(im.width+2*px,im.height+2*py));out.paste(im,(px,py))
    # Nine rectangles reproduce the nearest-edge clamp without pixel-by-pixel loops.
    for box,target,size in [((0,0,im.width,1),(px,0),(im.width,py)),((0,im.height-1,im.width,im.height),(px,py+im.height),(im.width,py)),((0,0,1,im.height),(0,py),(px,im.height)),((im.width-1,0,im.width,im.height),(px+im.width,py),(px,im.height))]:out.paste(im.crop(box).resize(size,Image.Resampling.NEAREST),target)
    for x,tx in [(0,0),(im.width-1,px+im.width)]:
        for y,ty in [(0,0),(im.height-1,py+im.height)]:out.paste(im.getpixel((x,y)),(tx,ty,tx+px,ty+py))
    assert out.crop((px,py,px+im.width,py+im.height)).tobytes()==im.tobytes()
    target=root/(name+'-padded.png');out.save(target,**({'icc_profile':profile} if profile else {}))
    assert Image.open(target).info.get('icc_profile')==profile
    record[name]={'source':str(p.relative_to(root)),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'derived':target.name,'derivedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'originalSize':im.size,'paddedSize':out.size,'paddingXY':[px,py],'originalPixelRectangleIdentical':True,'iccProfilePreserved':True,'iccSha256':hashlib.sha256(profile).hexdigest() if profile else None,'method':'Clamp to nearest original pixel outside intrinsic bounds; no resampling/mirroring/generation; source ICC retained.'}
if layout:
    for name in record:record[name]['paintCSS']=styles[name]
(root/'padding.json').write_text(json.dumps(record,indent=2)+'\n')
if layout:
    w=config['width']+10+25.4/96;h=config['height']+10+25.4/96
    pair=lambda values:' '.join(str(v)+'px' for v in values)
    sizes=','.join(pair(styles[k]['size']) for k in ['gradient','photo']);positions=','.join(pair(styles[k]['position']) for k in ['gradient','photo'])
    css=f"@page{{size:{w}mm {h}mm;margin:0}}@media print{{html,body{{width:{w}mm;height:{h}mm;background:#111;position:relative;overflow:hidden}}body{{background-image:url('gradient-padded.png'),url('photo-padded.png');background-size:{sizes};background-position:{positions};background-repeat:no-repeat}}body>div{{position:absolute;left:5mm;top:5mm;margin:0;background:transparent!important}}body>div>img:nth-child(-n+2){{visibility:hidden}}}}"
    (root/'photo-print.css').write_text(css)
