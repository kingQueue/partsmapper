import path from 'node:path';

// Normalize spelling only. Never resolve a model-supplied path outside its root.
export function projectRelative(root,value,platform=process.platform){
  const reject=()=>{throw Object.assign(Error('Path is outside the configured project or uses an unsafe spelling.'),{code:'PATH_DENIED',hint:'Use project.json, or wiring-handoff/project.json when the configured root is the parent project. An absolute path is accepted only inside the configured root.'});};
  if(typeof value!=='string'||!value||value.includes('\0')||value.length>1000)reject();
  let text=value.replaceAll('\\','/');
  if(text.startsWith('//')||text.split('/').includes('..'))reject();
  const api=platform==='win32'?path.win32:path.posix;
  if(/^[a-z]:/i.test(text)){
    if(platform!=='win32'||!api.isAbsolute(text))reject();
    text=api.relative(root,text).replaceAll('\\','/');
    if(text==='..'||text.startsWith('../')||api.isAbsolute(text))reject();
  }else if(text.startsWith('/')){
    if(platform==='win32')text=text.slice(1); // A project-root alias, never the drive root.
    else{
      text=api.relative(root,text);
      if(text==='..'||text.startsWith('../')||api.isAbsolute(text))reject();
    }
  }
  while(text.startsWith('./'))text=text.slice(2);
  if(!text||text.includes(':')||text.split('/').some(p=>!p||p==='.'||p==='..'))reject();
  return text;
}
