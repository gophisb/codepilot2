const q=id=>document.getElementById(id);
const apiBase="https://api.github.com";
const githubOwner="gophisb";
const bridgeUrl="https://github.com/gophisb/codepilot2/issues/new";
const workflowPath="codepilot-run.yml";
let generatedFiles=[], currentFileIndex=0;
let standaloneIndexPreview="";
let zipBinaryFiles=new Map();
let zipWarnings=[];

function setGithubStatus(message,kind){q("githubStatus").textContent=message;q("githubStatus").className="status "+(kind||"");}
function renderGithubState(){
  setGithubStatus("GitHub جاهز عبر جسر GitHub Actions — لا يوجد Token محفوظ في CodePilot2.","ok");
  q("githubLogin").textContent="فتح GitHub";
}
function b64utf8(value){return btoa(unescape(encodeURIComponent(String(value||""))));}
function buildBridgeBody({requestId,project,provider,stack,platform,prompt}){
  return [
    "<!-- CodePilot2 request",
    "request_id="+requestId,
    "project="+project,
    "provider="+provider,
    "stack="+stack,
    "platform="+platform,
    "prompt_b64="+b64utf8(prompt),
    "-->",
    "",
    "CodePilot2 request generated from GitHub Pages."
  ].join("\n");
}
function openGithubRequest(data){
  const title="CodePilot2: "+data.project+" ["+data.requestId+"]";
  const url=bridgeUrl+"?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(buildBridgeBody(data));
  const w=window.open(url,"_blank","noopener");
  if(!w)window.location.href=url;
  return url;
}
async function waitForRunPublic(requestId){
  const deadline=Date.now()+20*60*1000;
  while(Date.now()<deadline){
    const r=await fetch(apiBase+"/repos/"+githubOwner+"/codepilot2/actions/workflows/"+workflowPath+"/runs?per_page=50&event=workflow_dispatch",{cache:"no-store"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||("GitHub Actions HTTP "+r.status));
    const run=(data.workflow_runs||[]).find(x=>String(x.name||"").includes(requestId)||String(x.display_title||"").includes(requestId));
    if(run){
      if(run.status==="completed")return run;
      setStatus("3/5 GitHub Actions يعمل الآن: "+(run.status||"queued")+"…","ok");
    }else setStatus("2/5 تم إرسال الطلب إلى GitHub؛ ننتظر تشغيل Actions…","ok");
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error("انتهت مهلة انتظار GitHub Actions.");
}
async function waitForPagesPublic(owner,project,sinceMs){
  const deadline=Date.now()+10*60*1000;
  while(Date.now()<deadline){
    const r=await fetch(apiBase+"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(project)+"/actions/workflows/deploy-pages.yml/runs?per_page=10&event=push",{cache:"no-store"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||("GitHub Pages Actions HTTP "+r.status));
    const runs=(data.workflow_runs||[]).filter(x=>new Date(x.created_at||0).getTime()>=sinceMs-120000);
    const run=runs[0];
    if(run){
      if(run.status==="completed"){
        if(run.conclusion==="success")return run;
        throw new Error("فشل نشر GitHub Pages: "+(run.conclusion||"completed")+". افتح سجل deploy-pages.yml للتفاصيل.");
      }
      setStatus("5/6 يتم نشر الموقع على GitHub Pages: "+(run.status||"queued")+"…","ok");
    }else setStatus("5/6 تم إنشاء المستودع؛ ننتظر بدء نشر GitHub Pages…","ok");
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error("انتهت مهلة انتظار نشر GitHub Pages.");
}
async function waitForRepoPublic(owner,project,sinceMs){
  const deadline=Date.now()+5*60*1000;
  while(Date.now()<deadline){
    const r=await fetch(apiBase+"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(project),{cache:"no-store"});
    if(r.ok){
      const repo=await r.json();
      if(new Date(repo.created_at).getTime()>=sinceMs-120000)return repo;
    }else if(r.status!==404){
      const d=await r.json().catch(()=>({}));
      throw new Error(d.message||("GitHub API HTTP "+r.status));
    }
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error("تم تشغيل Actions لكن المستودع الناتج لم يظهر بعد.");
}
q("githubLogin").onclick=()=>{
  const prompt=q("prompt").value.trim();
  const project=q("project").value.trim()||"my-codepilot-app";
  const requestId="cp-connect-"+Date.now().toString(36);
  if(!prompt){
    setGithubStatus("اكتب وصف التطبيق أولاً، ثم سيُفتح GitHub لإرسال طلب CodePilot2.","");
    q("prompt").focus(); return;
  }
  if(!validProject(project)){
    setGithubStatus("اسم المشروع يجب أن يكون أحرفاً إنجليزية وأرقاماً و . _ - فقط.","err"); return;
  }
  openGithubRequest({requestId,project,provider:q("provider").value,stack:q("stack").value,platform:q("platform").value,prompt});
  setGithubStatus("تم فتح GitHub. اضغط Submit new issue لإرسال الطلب.","ok");
};

function buildPrompt(){
 return [
  "وصف التطبيق: "+q("prompt").value.trim(),
  "التقنية: "+q("stack").value,
  "المنصة: "+q("platform").value,
  "اسم المشروع: "+q("project").value.trim(),
  "المزود: "+q("provider").value
 ].join("\n");
}
function setStatus(message,kind){q("status").textContent=message;q("status").className="status "+(kind||"");}
function validProject(name){return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name)&&name!=="."&&name!=="..";}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true}catch{
  const a=document.createElement("textarea");a.value=text;document.body.appendChild(a);a.select();
  const ok=document.execCommand("copy");a.remove();return ok;
 }
}
q("generate").onclick=async()=>{
 const prompt=q("prompt").value.trim(), project=q("project").value.trim();
 if(!prompt){setStatus("اكتب وصف التطبيق أولاً.","err");return;}
 if(!validProject(project)){setStatus("اسم المشروع غير صالح لـ GitHub.","err");return;}
 q("generate").disabled=true;
 const startedAt=Date.now();
 const requestId="cp-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
 try{
   setStatus("1/5 فتح GitHub لإرسال طلب التنفيذ…","");
   openGithubRequest({requestId,project,provider:q("provider").value,stack:q("stack").value,platform:q("platform").value,prompt});
   setStatus("1/5 افتح GitHub واضغط Submit new issue. سيكمل CodePilot2 المتابعة تلقائياً.","ok");
   const run=await waitForRunPublic(requestId);
   if(run.conclusion!=="success")throw new Error("فشل Workflow: "+(run.conclusion||run.status)+". افتح سجل Actions للتفاصيل.");
   setStatus("4/5 اكتمل التوليد. نبحث عن المستودع الناتج…","ok");
   const repo=await waitForRepoPublic(githubOwner,project,startedAt);
   q("repoUrl").value=repo.html_url;
   if(/web|pwa/i.test(q("platform").value)){
     setStatus("5/6 المستودع جاهز؛ نتحقق من نشر GitHub Pages…","ok");
     await waitForPagesPublic(githubOwner,repo.name,startedAt);
     const publicUrl="https://"+githubOwner+".github.io/"+repo.name+"/";
     q("publicSiteLink").href=publicUrl;q("publicSiteLink").textContent=publicUrl;q("publicSite").style.display="block";
     setStatus("6/6 تم إنشاء المشروع ونشره على GitHub Pages ✓","ok");
   }else setStatus("5/5 تم إنشاء المستودع بنجاح ✓","ok");
   await loadRepository();
 }catch(e){setStatus("فشل التوليد: "+(e.message||e),"err");}
 finally{q("generate").disabled=false;}
};

async function loadZipProject(file){
 if(!window.JSZip)throw new Error("مكوّن ZIP لم يتم تحميله بعد؛ أعد فتح الصفحة.");
 if(!file)throw new Error("اختر ملف ZIP أولاً.");
 if(file.size>25*1024*1024)throw new Error("ملف ZIP أكبر من 25 MB.");
 const zip=await JSZip.loadAsync(file,{createFolders:false,checkCRC32:false});
 const fileEntries=Object.keys(zip.files).map(name=>zip.files[name]).filter(entry=>!entry.dir);
 if(fileEntries.length>200)throw new Error("ملف ZIP يحتوي على أكثر من 200 ملف.");
 const entries=[]; let total=0; zipWarnings=[]; zipBinaryFiles=new Map();
 for(const entry of fileEntries){
  const original=String(entry.unsafeOriginalName||entry.name||"");
  const safe=original.replace(/\\/g,"/");
  if(!safe||safe.startsWith("/")||safe.split("/").some(p=>p===".."||p==="."||p==="")){zipWarnings.push(original+" — مسار غير آمن");continue;}
  if(safe.startsWith(".git/")||safe.startsWith(".github/")){zipWarnings.push(safe+" — مسار محظور");continue;}
  if(entry._data&&entry._data.uncompressedSize>500*1024){zipWarnings.push(safe+" — أكبر من 500 KB");continue;}
  const bytes=await entry.async("uint8array");
  if(bytes.byteLength>500*1024){zipWarnings.push(safe+" — أكبر من 500 KB");continue;}
  total+=bytes.byteLength;
  let content="";
  let isText=true;
  try{
   content=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   if(content.includes("\u0000"))isText=false;
  }catch{isText=false;}
  if(!isText){
   const base64=await entry.async("base64");
   zipBinaryFiles.set(safe,{base64,mime:zipMimeType(safe)});
   content=base64;
  }
  entries.push({path:safe,content});
 }
 if(!entries.length)throw new Error("لم نجد ملفات قابلة للعرض داخل ZIP.");
 generatedFiles=entries;
 q("files").innerHTML="";
 generatedFiles.forEach((f,i)=>{const o=document.createElement("option");o.value=i;o.textContent=f.path;q("files").appendChild(o);});
 q("files").onchange=()=>showFile(q("files").value);
 q("summary").textContent="تم فتح ZIP: "+generatedFiles.length+" ملفاً.";
 q("output").style.display="block"; showFile(0); buildPreview();
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active")); q("previewPanel").classList.add("active"); document.querySelector(".tab[data-tab=\"preview\"]").classList.add("active");
 const packageFile=generatedFiles.find(f=>normalizePath(f.path)==="package.json"||normalizePath(f.path).endsWith("/package.json"));
 let status="تم تحميل "+generatedFiles.length+" ملف، الحجم الإجمالي "+(total/1024).toFixed(1)+" KB";
 if(zipWarnings.length)status+="<br>"+zipWarnings.map(x=>"⚠️ "+x).join("<br>");
 q("loadStatus").innerHTML=packageFile ? status+"<br>تم اكتشاف package.json؛ التثبيت والتشغيل الفعلي يحتاجان Build عبر GitHub Actions." : status;
 q("loadStatus").className="status ok";
 q("publishZip").style.display="block";
 q("output").scrollIntoView({behavior:"smooth",block:"start"});
}
function zipMimeType(path){
 const ext=String(path).split(".").pop().toLowerCase();
 return ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf"}[ext]||"application/octet-stream");
}
function base64ToUint8(base64){
 const binary=atob(base64); const out=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
 return out;
}
function addGeneratedFilesToZip(zip){
 generatedFiles.forEach(f=>{
   const path=normalizePath(f.path);
   const binary=zipBinaryFiles.get(path);
   if(binary)zip.file(path,f.content,{base64:true,binary:true});
   else zip.file(path,f.content);
 });
}
async function publishZipProject(){
 if(!generatedFiles.length){
   q("zipRunStatus").textContent="ارفع ZIP أولاً.";
   q("zipRunStatus").className="status err";
   return;
 }
 updateFileFromEditor();
 const b=q("publishZip"); b.disabled=true;
 try{
   q("zipRunStatus").textContent="⏳ جارٍ تجهيز ZIP وإرساله إلى GitHub…"; q("zipRunStatus").className="status";
   const zip=new JSZip();
   addGeneratedFilesToZip(zip);
   const base64payload=await zip.generateAsync({type:"base64",compression:"DEFLATE",compressionOptions:{level:6}});
   if(base64payload.length>61440){
     q("zipRunStatus").textContent="حجم المشروع يتجاوز 60KB — لا يمكن رفعه عبر هذه الواجهة حالياً";
     q("zipRunStatus").className="status err";
     return;
   }
   const projectName=prompt('اسم المشروع على GitHub (بدون مسافات):');
   if(!projectName || !projectName.trim()) return;
   const safeName=projectName.trim()
     .toLowerCase()
     .replace(/[^a-z0-9-]/g,'-')
     .replace(/^-+|-+$/g,'')
     .slice(0,50) || 'zip-project';
   const title="[ZIP-PUSH] "+safeName;
   const body="project_name="+safeName+"\n"+base64payload;
   const url=bridgeUrl+"?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
   const w=window.open(url,"_blank","noopener"); if(!w)window.location.href=url;
   q("zipRunStatus").textContent="تم إرسال طلب الرفع — تابع التقدم في Issues";
   q("zipRunStatus").className="status ok";
 }catch(e){
   q("zipRunStatus").textContent="فشل رفع ZIP: "+(e.message||e);
   q("zipRunStatus").className="status err";
 }finally{b.disabled=false;}
}
q("publishZip").onclick=publishZipProject;

async function handleZipFile(file){
 const s=q("zipStatus");
 q("publishZip").style.display="none";
 s.textContent="جارٍ فحص ZIP…";s.className="status";
 try{await loadZipProject(file);s.textContent="تم تحميل المشروع من ZIP ✓";s.className="status ok";}
 catch(e){s.textContent="فشل فتح ZIP: "+(e.message||e);s.className="status err";q("publishZip").style.display="none";}
}
q("zipInput").onchange=async()=>handleZipFile(q("zipInput").files[0]);
const zipDropZone=q("zipDropZone");
if(zipDropZone){
 ["dragenter","dragover"].forEach(type=>zipDropZone.addEventListener(type,e=>{e.preventDefault();zipDropZone.classList.add("dragover");}));
 ["dragleave","drop"].forEach(type=>zipDropZone.addEventListener(type,e=>{e.preventDefault();zipDropZone.classList.remove("dragover");}));
 zipDropZone.addEventListener("drop",e=>handleZipFile(e.dataTransfer.files[0]));
}

function updateFileFromEditor(){
 const f=generatedFiles[currentFileIndex];
 if(f) f.content=q("codeView").value;
}
function showFile(index){
 currentFileIndex=Number(index)||0;const f=generatedFiles[currentFileIndex];if(!f)return;
 q("codeView").value=f.content;q("fileInfo").textContent=f.path+" — "+f.content.length+" حرف";
}
function normalizePath(p){return p.replace(/\\/g,"/").replace(/^\.\//,"").replace(/^\//,"");}
function resolvePreviewPath(baseFile,assetPath){
 const raw=String(assetPath||"").split("?")[0].split("#")[0].trim();
 if(!raw||/^(https?:|data:|blob:|javascript:|#)/i.test(raw))return null;
 const clean=normalizePath(raw);
 const base=raw.startsWith("/")?[]:normalizePath(baseFile).split("/");
 if(!raw.startsWith("/"))base.pop();
 for(const part of clean.split("/")){
   if(!part||part===".")continue;
   if(part==="..")base.pop();else base.push(part);
 }
 return normalizePath(base.join("/"));
}
function previewDataUrl(text,mime){
 return "data:"+mime+";charset=utf-8,"+encodeURIComponent(String(text||""));
}
function buildPreview(){
 const frame=q("preview");
 const htmlFile=standaloneIndexPreview
   ? {path:"index.html",content:standaloneIndexPreview}
   : generatedFiles.find(f=>normalizePath(f.path)==="index.html"||normalizePath(f.path).endsWith("/index.html"));
 if(!htmlFile){
   frame.srcdoc="<body style='font-family:system-ui;padding:20px'><h3>لا توجد index.html</h3><p>المعاينة الحالية مخصصة لمشاريع الويب.</p></body>";
   return;
 }

 const map=new Map(generatedFiles.map(f=>[normalizePath(f.path),f]));
 if(standaloneIndexPreview)map.set("index.html",{path:"index.html",content:standaloneIndexPreview});
 let html=htmlFile.content;
 html=html.replace(/<base\b[^>]*>/gi,"");

 const moduleCache=new Map();
 const makeModuleUrl=(path,stack)=>{
   const key=normalizePath(path);
   if(moduleCache.has(key))return moduleCache.get(key);
   const file=map.get(key);
   if(!file)return null;
   if((stack||[]).includes(key))return null;
   let js=file.content;
   const nextStack=[...(stack||[]),key];
   js=js.replace(/((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()(["'])(\.{1,2}\/[^"']+)\2/g,(m,prefix,quote,spec)=>{
     const dep=resolvePreviewPath(key,spec);
     if(!dep)return m;
     const depUrl=makeModuleUrl(dep,nextStack);
     return depUrl?prefix+quote+depUrl+quote:m;
   });
   const url=previewDataUrl(js,"text/javascript");
   moduleCache.set(key,url);
   return url;
 };

 // Inline local CSS and rewrite local url(...) references when the target is text/SVG.
 html=html.replace(/<link\b([^>]*?)\bhref=["']([^"']+)["']([^>]*)>/gi,(m,a,p,c)=>{
   if(!/\.css(?:[?#].*)?$/i.test(p))return m;
   const key=resolvePreviewPath(htmlFile.path,p);
   const f=key&&map.get(key);
   if(!f)return m;
   let css=f.content;
   css=css.replace(/url\((["']?)(?!data:|https?:|blob:|#)([^)"']+)\1\)/gi,(um,q2,p2)=>{
     const dep=resolvePreviewPath(key,p2);
     const asset=dep&&map.get(dep);
     if(!asset)return um;
     if(/\.svg$/i.test(dep))return "url("+previewDataUrl(asset.content,"image/svg+xml")+")";
     if(/\.(css|txt|json|js)$/i.test(dep))return "url("+previewDataUrl(asset.content,"text/plain")+")";
     return um;
   });
   return "<style data-codepilot-preview>\n"+css+"\n</style>";
 });

 // Inline local scripts. Module imports are converted to self-contained data URLs.
 html=html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,(m,a,p,c)=>{
   const key=resolvePreviewPath(htmlFile.path,p);
   const f=key&&map.get(key);
   if(!f)return m;
   const attrs=(a+" "+c)
     .replace(/\bsrc\s*=\s*["'][^"']*["']/gi,"")
     .replace(/\s+/g," ")
     .trim();
   let js=f.content;
   if(/\btype\s*=\s*["']module["']/i.test(attrs)){
     const url=makeModuleUrl(key,[]);
     if(url){
       return "<script type=\"module\" data-codepilot-preview>\nimport \""+url+"\";\n</script>";
     }
   }
   js=js.replace(/<\/script/gi,"<\\/script");
   return "<script"+(attrs?" "+attrs:"")+" data-codepilot-preview>\n"+js+"\n</script>";
 });

 // Rewrite ordinary local image/media links to data URLs when their content is available.
 html=html.replace(/\b(src|poster|href)=["']([^"']+)["']/gi,(m,attr,p)=>{
   if(!/^(src|poster)$/i.test(attr))return m;
   const key=resolvePreviewPath(htmlFile.path,p);
   const asset=key&&map.get(key);
   if(!asset)return m;
   let mime="text/plain";
   if(/\.svg$/i.test(key))mime="image/svg+xml";
   else if(/\.html?$/i.test(key))mime="text/html";
   else if(/\.json$/i.test(key))mime="application/json";
   else if(/\.txt$/i.test(key))mime="text/plain";
   else return m;
   return attr+'="'+previewDataUrl(asset.content,mime)+'"';
 });

 const diagnostics="<script>(function(){function show(msg){try{var b=document.getElementById('__cp_error__')||document.body.appendChild(document.createElement('pre'));b.id='__cp_error__';b.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:white;color:#b00020;border:1px solid #b00020;padding:10px;font:12px monospace;white-space:pre-wrap;max-height:45vh;overflow:auto';b.textContent='CodePilot2 Preview Error\n'+msg;}catch(_){}}window.addEventListener('error',function(e){show((e.message||'Runtime error')+(e.filename?'\n'+e.filename:'')+(e.lineno?'\nline '+e.lineno:''));});window.addEventListener('unhandledrejection',function(e){show('Unhandled promise rejection\n'+(e.reason&&e.reason.stack||e.reason||'Unknown error'));});})();</script>";
 if(/<body\b/i.test(html))html=html.replace(/<body\b([^>]*)>/i,"<body$1>"+diagnostics);
 else html=diagnostics+html;
 frame.srcdoc=html;
}


async function downloadProjectZip(){
  if(!window.JSZip || !generatedFiles.length){ alert("لا يوجد مشروع جاهز."); return; }
  const zip=new JSZip();
  addGeneratedFilesToZip(zip);
  const blob=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=(safeRepoUrl(q("repoUrl").value)?.repo||"codepilot-project")+".zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function buildPublishIssueBody(){
  const parsed=safeRepoUrl(q("repoUrl").value);
  if(!parsed) throw new Error("ضع رابط مستودع GitHub الهدف أولاً.");
  if(!generatedFiles.length) throw new Error("لا توجد ملفات لرفعها.");
  const payload={target_owner:parsed.owner,target_repo:parsed.repo,files:generatedFiles.map(f=>({path:normalizePath(f.path),content:f.content}))};
  const encoded=b64utf8(JSON.stringify(payload));
  if(encoded.length>90000) throw new Error("المشروع كبير جدًا للرفع المباشر عبر GitHub Issue. استخدم ZIP/Actions للمشاريع الكبيرة.");
  return ["<!-- CodePilot2 publish","payload_b64="+encoded,"-->","","CodePilot2 publish request."].join("\n");
}

function publishCodeToGitHub(){
  const parsed=safeRepoUrl(q("repoUrl").value);
  if(!parsed){ q("loadStatus").textContent="ضع رابط مستودع GitHub الهدف أولاً.";q("loadStatus").className="status err";return; }
  updateFileFromEditor();
  try{
    const requestId="cpp-"+Date.now().toString(36);
    const title="CodePilot2 Publish: "+parsed.repo+" ["+requestId+"]";
    const body=buildPublishIssueBody();
    const url="https://github.com/gophisb/codepilot2/issues/new?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
    const w=window.open(url,"_blank","noopener"); if(!w)window.location.href=url;
    q("loadStatus").textContent="تم تجهيز طلب الرفع إلى GitHub. اضغط Submit new issue، وسيقوم Actions بإنشاء/تحديث الملفات في المستودع الهدف.";
    q("loadStatus").className="status ok";
  }catch(e){q("loadStatus").textContent="فشل تجهيز الرفع: "+(e.message||e);q("loadStatus").className="status err";}
}

function safeRepoUrl(value){
 try{
  let raw=String(value||"").trim();
  if(!raw)return null;
  raw=raw.replace(/[\u200B-\u200D\uFEFF]/g,"").trim();

  const match=raw.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com|[A-Za-z0-9-]+\.github\.io)\/[^\s<>"]+/i);
  if(match)raw=match[0];
  if(!/^https?:\/\//i.test(raw))raw="https://"+raw;
  raw=raw.replace(/[),.;!?]+$/,"");

  const u=new URL(raw);
  const host=u.hostname.toLowerCase();

  if(host==="github.com" || host==="www.github.com"){
    const parts=u.pathname.split("/").filter(Boolean);
    if(parts.length<2)return null;
    const owner=decodeURIComponent(parts[0]).trim();
    const repo=decodeURIComponent(parts[1]).replace(/\.git$/i,"").trim();
    if(!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo))return null;
    return {owner,repo};
  }

  const m=host.match(/^([a-z0-9-]+)\.github\.io$/i);
  if(m){
    const parts=u.pathname.split("/").filter(Boolean);
    if(!parts.length)return null;
    const repo=decodeURIComponent(parts[0]).replace(/\.git$/i,"").trim();
    if(!/^[A-Za-z0-9._-]+$/.test(repo))return null;
    return {owner:m[1],repo};
  }
  return null;
 }catch{return null;}
}
async function githubJson(url){
 const r=await fetch(url,{headers:{"Accept":"application/vnd.github+json"}});
 if(!r.ok)throw new Error("GitHub API HTTP "+r.status);
 return r.json();
}
async function loadRepository(){
 const parsed=safeRepoUrl(q("repoUrl").value);
 if(!parsed){q("loadStatus").textContent="رابط GitHub العام غير صالح.";q("loadStatus").className="status err";return;}
 const button=q("loadRepo");button.disabled=true;q("publishZip").style.display="none";q("loadStatus").textContent="جارٍ قراءة المستودع...";q("loadStatus").className="status";
 try{
  const repo=await githubJson("https://api.github.com/repos/"+encodeURIComponent(parsed.owner)+"/"+encodeURIComponent(parsed.repo));
  const branch=repo.default_branch||"main";
  const tree=await githubJson("https://api.github.com/repos/"+parsed.owner+"/"+parsed.repo+"/git/trees/"+encodeURIComponent(branch)+"?recursive=1");
  if(tree.truncated)throw new Error("المستودع كبير جداً للتحميل المباشر؛ افتح المستودع أو حمّل الملفات على دفعات.");
  const candidates=(tree.tree||[]).filter(x=>x.type==="blob"&&!x.path.startsWith(".git/")&&!/(^|\/)(node_modules|dist|build|\.next|\.git)(\/|$)/.test(x.path)).slice(0,100);
  if(!candidates.length)throw new Error("لم نجد ملفات نصية قابلة للعرض.");
  generatedFiles=[];
  zipBinaryFiles=new Map(); zipWarnings=[];
  for(const item of candidates){
   if(item.size>300000)continue;
   const raw="https://raw.githubusercontent.com/"+parsed.owner+"/"+parsed.repo+"/"+encodeURIComponent(branch)+"/"+item.path.split("/").map(encodeURIComponent).join("/");
   const r=await fetch(raw,{cache:"no-store"});
   if(!r.ok)continue;
   const content=await r.text();
   if(content.includes("\u0000"))continue;
   generatedFiles.push({path:item.path,content});
  }
  if(!generatedFiles.length)throw new Error("لم يمكن قراءة الملفات النصية.");
  q("files").innerHTML="";
  generatedFiles.forEach((f,i)=>{const o=document.createElement("option");o.value=i;o.textContent=f.path;q("files").appendChild(o);});
  q("files").onchange=()=>showFile(q("files").value);
  q("summary").textContent="تم تحميل "+generatedFiles.length+" ملفاً من "+parsed.owner+"/"+parsed.repo+" (branch: "+branch+").";
  q("output").style.display="block";showFile(0);buildPreview();
  q("loadStatus").textContent="تم التحميل بنجاح ✓";q("loadStatus").className="status ok";
  q("output").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){q("loadStatus").textContent="فشل تحميل المشروع: "+(e.message||e);q("loadStatus").className="status err";}
 finally{button.disabled=false;}
}
q("loadRepo").onclick=loadRepository;
q("codeView").addEventListener("input",()=>{if(generatedFiles[currentFileIndex]){generatedFiles[currentFileIndex].content=q("codeView").value;buildPreview();}});
q("copyCode").onclick=async()=>{const ok=await copyText(q("codeView").value);q("copyCode").textContent=ok?"تم نسخ الكود ✓":"فشل النسخ";setTimeout(()=>q("copyCode").textContent="نسخ الكود",1500);};
q("copyPath").onclick=async()=>{const ok=await copyText(generatedFiles[currentFileIndex]?.path||"");q("copyPath").textContent=ok?"تم نسخ المسار ✓":"فشل النسخ";setTimeout(()=>q("copyPath").textContent="نسخ مسار الملف",1500);};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");q(b.dataset.tab==="code"?"codePanel":"previewPanel").classList.add("active");if(b.dataset.tab==="preview")buildPreview();
});
renderGithubState();
q("prompt").addEventListener("touchstart",()=>q("prompt").focus(),{passive:true});
q("codeView").addEventListener("touchstart",()=>q("codeView").focus(),{passive:true});


function renderStandaloneIndexPreview(){
  const frame=q("indexPreview");
  const code=q("indexCode");
  if(!frame||!code)return;
  let html=String(code.value||"");
  html=html.replace(/<base\b[^>]*>/gi,"");
  const diagnostics="<script>(function(){function show(msg){try{var b=document.getElementById('__cp_index_error__')||document.body.appendChild(document.createElement('pre'));b.id='__cp_index_error__';b.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:white;color:#b00020;border:1px solid #b00020;padding:10px;font:12px monospace;white-space:pre-wrap;max-height:45vh;overflow:auto';b.textContent='index.html Preview Error\\n'+msg;}catch(_){}}window.addEventListener('error',function(e){show((e.message||'Runtime error')+(e.lineno?'\\nline '+e.lineno:''));});window.addEventListener('unhandledrejection',function(e){show('Unhandled promise rejection\\n'+(e.reason&&e.reason.stack||e.reason||'Unknown error'));});})();<\\/script>";
  if(/<body\b/i.test(html))html=html.replace(/<body\b([^>]*)>/i,"<body$1>"+diagnostics);
  else html=diagnostics+html;
  frame.srcdoc=html;
}
function loadStandaloneIndex(file){
  if(!file)return;
  const name=String(file.name||"").toLowerCase();
  if(!/\.html?$/.test(name)){q("indexStatus").textContent="اختر ملف HTML فقط.";q("indexStatus").className="status err";return;}
  if(file.size>5*1024*1024){q("indexStatus").textContent="index.html أكبر من 5MB؛ اختر نسخة أصغر للقراءة الآمنة.";q("indexStatus").className="status err";return;}
  const reader=new FileReader();
  reader.onload=()=>{
    q("indexCode").value=String(reader.result||"");
    standaloneIndexPreview=q("indexCode").value;
    q("indexReader").style.display="block";
    q("indexStatus").textContent="تمت قراءة "+file.name+" ✓ — الكود مستقل عن المشروع الحالي.";
    q("indexStatus").className="status ok";
    renderStandaloneIndexPreview();
    q("summary").textContent="تم تحميل index.html محلياً — المسار المعروض في المعاينة: index.html";
    q("output").style.display="block";
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    q("previewPanel").classList.add("active");
    document.querySelector(".tab[data-tab=\"preview\"]").classList.add("active");
    buildPreview();
    q("output").scrollIntoView({behavior:"smooth",block:"start"});
  };
  reader.onerror=()=>{q("indexStatus").textContent="تعذر قراءة الملف.";q("indexStatus").className="status err";};
  reader.readAsText(file,"UTF-8");
}
if(q("indexInput")){
  q("indexInput").onchange=()=>loadStandaloneIndex(q("indexInput").files[0]);
  q("indexCode").addEventListener("input",()=>{
    standaloneIndexPreview=q("indexCode").value;
    renderStandaloneIndexPreview();
    buildPreview();
  });
  q("copyIndexCode").onclick=async()=>{
    const ok=await copyText(q("indexCode").value);
    q("copyIndexCode").textContent=ok?"تم نسخ index.html ✓":"فشل النسخ";
    setTimeout(()=>q("copyIndexCode").textContent="نسخ index.html",1500);
  };
  q("refreshIndexPreview").onclick=renderStandaloneIndexPreview;
}

q("publishCode").onclick=publishCodeToGitHub;
q("downloadProject").onclick=downloadProjectZip;
