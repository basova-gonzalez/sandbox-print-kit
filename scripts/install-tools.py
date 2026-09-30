"""Install the locked macOS arm64 checkpoint tools locally; no global registry."""
import sys,platform,json,subprocess,hashlib,shutil,tarfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if sys.version.split()[0]!='3.12.13' or platform.system()!='Darwin' or platform.machine()!='arm64':
    raise SystemExit('This checkpoint lock requires Python 3.12.13 on macOS arm64. Other platforms remain unverified.')
def download(url,relative,expected):
    dest=ROOT/relative;dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():subprocess.run(['curl','-LsSf','--retry','1','--max-time','90','-o',str(dest),url],check=True)
    if hashlib.sha256(dest.read_bytes()).hexdigest()!=expected:raise RuntimeError('Download hash mismatch: '+relative)
    return dest
archive=download('https://micro.mamba.pm/api/micromamba/osx-arm64/2.9.0','.bootstrap/micromamba-2.9.0.tar.bz2','500f5074feb8d02c4296ef9921c3650ed2874171805a9fbb8fbb53896433646b')
extractor=ROOT/'.bootstrap/bin/micromamba';extractor.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(archive) as tf:extractor.write_bytes(tf.extractfile('bin/micromamba').read())
extractor.chmod(0o755)
items=json.loads((ROOT/'docs/acquisition-lock.json').read_text())
def merge(source,target):
    if source.is_symlink():
        if target.is_symlink():
            if os.readlink(source)!=os.readlink(target):raise RuntimeError('Conflicting tool link: '+str(target))
        elif target.exists():raise RuntimeError('Conflicting tool path: '+str(target))
        else:target.symlink_to(os.readlink(source))
    elif source.is_dir():
        target.mkdir(parents=True,exist_ok=True)
        for child in source.iterdir():merge(child,target/child.name)
    elif target.exists():
        if source.read_bytes()!=target.read_bytes():raise RuntimeError('Conflicting tool file: '+str(target))
    else:shutil.copy2(source,target)
for x in items:
    archive=download(x['url'],x['path'],x['sha256'])
    if '/channel/' not in x['path']:continue
    dest=ROOT/'.bootstrap/extracted'/archive.name
    if not dest.exists():subprocess.run([str(extractor),'package','extract',str(archive),str(dest)],check=True)
    for item in dest.iterdir():
        if item.name=='info':continue
        target=ROOT/'.tools/poppler'/item.name
        target.parent.mkdir(parents=True,exist_ok=True)
        merge(item,target)
venv=ROOT/'.venv'
if not venv.exists():subprocess.run([sys.executable,'-m','venv',str(venv)],check=True)
subprocess.run([str(venv/'bin/python'),'-m','pip','install','--no-index','--find-links',str(ROOT/'.bootstrap/wheels'),'--require-hashes','-r',str(ROOT/'requirements.lock')],check=True)
subprocess.run([str(ROOT/'.tools/poppler/bin/pdftoppm'),'-v'],check=True)
print('Local checkpoint tools installed. No conda environment registration or package link scripts executed.')
