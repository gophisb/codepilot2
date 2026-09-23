const q=id=>document.getElementById(id);
const apiBase="https://api.github.com";
const githubOwner="gophisb";
const bridgeUrl="https://github.com/gophisb/codepilot2/issues/new";
const workflowPath="codepilot-run.yml";
let generatedFiles=[], currentFileIndex=0;
let pollTimer=null;
let githubToken="";
let githubLoginName=githubOwner;

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
    const r=await fetch(apiBase+"/repos/"+githubOwner+"/codepilot2/actions/workflows/"+workflowPath+"/runs?per_page=50&event=repository_dispatch",{cache:"no-store"});
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
async function ensureGithubConnection(){return true;}

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
async function waitForRun(requestId,project){
 const deadline=Date.now()+20*60*1000;
 while(Date.now()<deadline){
   const data=await authedJson(apiBase+"/repos/gophisb/codepilot2/actions/workflows/"+workflowPath+"/runs?per_page=20");
   const run=(data.workflow_runs||[]).find(x=>
     String(x.name||"").includes(requestId) ||
     String(x.display_title||"").includes(requestId)
   );
   if(run){
     if(run.status==="completed")return run;
     setStatus("Actions يعمل الآن: "+(run.status||"queued")+"…","ok");
   }else{
     setStatus("تم إرسال الطلب؛ ننتظر ظهور تشغيل Actions…","ok");
   }
   await new Promise(r=>setTimeout(r,5000));
 }
 throw new Error("انتهت مهلة انتظار GitHub Actions.");
}
async function waitForRepo(owner,project,sinceMs){
 const deadline=Date.now()+5*60*1000;
 while(Date.now()<deadline){
   try{
     const exact=await authedJson(apiBase+"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(project));
     if(new Date(exact.created_at).getTime()>=sinceMs-60000)return exact;
   }catch(e){
     if(!String(e.message).includes("Not Found"))throw e;
   }
   const repos=await authedJson(apiBase+"/user/repos?per_page=100&sort=created&direction=desc");
   const candidate=(repos||[]).find(x=>{
     if(x.owner?.login!==owner || new Date(x.created_at).getTime()<sinceMs-60000)return false;
     if(x.name===project)return true;
     if(!x.name.startsWith(project+"-"))return false;
     return /^-\d+$/.test(x.name.slice(project.length));
   });
   if(candidate)return candidate;
   await new Promise(r=>setTimeout(r,5000));
 }
 throw new Error("انتهت مهلة انتظار المستودع الناتج.");
}
async function waitForPages(owner,project){
 const deadline=Date.now()+5*60*1000;
 const url=apiBase+"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(project)+"/pages";
 while(Date.now()<deadline){
   try{
     const pages=await authedJson(url);
     if(pages&&pages.html_url)return pages.html_url;
     if(pages&&pages.status==="built")return "https://"+owner+".github.io/"+project+"/";
   }catch(e){
     if(!String(e.message).includes("HTTP 404"))throw e;
   }
   await new Promise(r=>setTimeout(r,5000));
 }
 throw new Error("تم إنشاء المستودع لكن GitHub Pages لم يصبح جاهزاً بعد.");
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
     const publicUrl="https://"+githubOwner+".github.io/"+repo.name+"/";
     q("publicSiteLink").href=publicUrl;q("publicSiteLink").textContent=publicUrl;q("publicSite").style.display="block";
     setStatus("5/5 تم إنشاء المستودع ✓ يمكنك تحميله الآن.","ok");
   }else setStatus("5/5 تم إنشاء المستودع بنجاح ✓","ok");
   await loadRepository();
 }catch(e){setStatus("فشل التوليد: "+(e.message||e),"err");}
 finally{q("generate").disabled=false;}
};

async function loadZipProject(file){
 if(!window.JSZip)throw new Error("مكوّن ZIP لم يتم تحميله بعد؛ أعد فتح الصفحة.");
 if(!file)throw new Error("اختر ملف ZIP أولاً.");
 if(file.size>50*1024*1024)throw new Error("ملف ZIP أكبر من 50MB.");
 const zip=await JSZip.loadAsync(file,{createFolders:false,checkCRC32:false});
 const entries=[]; let total=0;
 for(const name of Object.keys(zip.files)){
  const entry=zip.files[name]; if(entry.dir)continue;
  const safe=name.replace(/\\/g,"/").replace(/^\/+/,"");
  if(!safe||safe.split("/").some(p=>p===".."||p===""))continue;
  if(/(^|\/)node_modules(\/|$)|(^|\/)\.git(\/|$)|(^|\/)dist(\/|$)|(^|\/)build(\/|$)/i.test(safe))continue;
  const content=await entry.async("string");
  if(content.includes("\u0000"))continue;
  total+=content.length;
  if(total>12*1024*1024)throw new Error("حجم الملفات النصية بعد الفك أكبر من 12MB.");
  entries.push({path:safe,content});
  if(entries.length>=200)break;
 }
 if(!entries.length)throw new Error("لم نجد ملفات نصية قابلة للعرض داخل ZIP.");
 generatedFiles=entries;
 q("files").innerHTML="";
 generatedFiles.forEach((f,i)=>{const o=document.createElement("option");o.value=i;o.textContent=f.path;q("files").appendChild(o);});
 q("files").onchange=()=>showFile(q("files").value);
 q("summary").textContent="تم فتح ZIP: "+generatedFiles.length+" ملفاً نصياً.";
 q("output").style.display="block"; showFile(0); buildPreview();
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active")); q("previewPanel").classList.add("active"); document.querySelector(".tab[data-tab=\"preview\"]").classList.add("active");
 const packageFile=generatedFiles.find(f=>normalizePath(f.path)==="package.json"||normalizePath(f.path).endsWith("/package.json"));
 q("loadStatus").textContent=packageFile ? "تم فتح ZIP ✓ — تم اكتشاف package.json؛ التثبيت والتشغيل الفعلي يحتاجان Build عبر GitHub Actions." : "تم فتح ZIP ✓ — المعاينة المحلية جاهزة.";q("loadStatus").className="status ok";
 q("output").scrollIntoView({behavior:"smooth",block:"start"});
}
async function createZipRepo(baseName){
 if(!githubToken)throw new Error("اربط GitHub أولاً.");
 let base=(baseName||"codepilot-zip-project").trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^[^A-Za-z0-9]+/,"").slice(0,90)||"codepilot-zip-project";
 let candidate=base, n=2;
 while(true){
   const r=await fetch(apiBase+"/repos/"+encodeURIComponent(githubLoginName)+"/"+encodeURIComponent(candidate),{headers:githubHeaders()});
   if(r.status===404)break;
   if(!r.ok)throw new Error("تعذر فحص اسم المستودع: HTTP "+r.status);
   const suffix="-"+n++;
   candidate=base.slice(0,100-suffix.length)+suffix;
 }
 return await authedJson(apiBase+"/user/repos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   name:candidate,description:"Project uploaded and deployed by CodePilot2-gophisb",private:false,
   has_issues:true,has_projects:false,has_wiki:false
 })});
}
const zipPagesWorkflow=(repoName)=>`name: Build and deploy ZIP project
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Setup Node
        if: hashFiles('package.json') != ''
        uses: actions/setup-node@v6
        with:
          node-version: 20
      - name: Install dependencies
        if: hashFiles('package.json') != ''
        run: |
          if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm install; fi
      - name: Build
        if: hashFiles('package.json') != ''
        run: |
          if grep -q '"vite"' package.json; then
            npm run build -- --base="/\${GITHUB_REPOSITORY#*/}/"
          else
            npm run build --if-present
          fi
      - name: Select output
        run: |
          if [ -d dist ]; then echo "PAGES_DIR=dist" >> "$GITHUB_ENV"
          elif [ -d build ]; then echo "PAGES_DIR=build" >> "$GITHUB_ENV"
          elif [ -d out ]; then echo "PAGES_DIR=out" >> "$GITHUB_ENV"
          elif [ -f index.html ]; then echo "PAGES_DIR=." >> "$GITHUB_ENV"
          else echo "PAGES_DIR=." >> "$GITHUB_ENV"; fi
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: \${{ env.PAGES_DIR }}
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    permissions:
      pages: write
      id-token: write
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
`;
async function publishZipProject(){
 if(!generatedFiles.length){q("zipRunStatus").textContent="ارفع ZIP أولاً.";q("zipRunStatus").className="status err";return;}
 if(!githubToken){
   q("zipRunStatus").textContent="نفتح الآن ربط GitHub…";q("zipRunStatus").className="status";
   try{if(!(await ensureGithubConnection()))throw new Error("لم يكتمل ربط GitHub.");}
   catch(e){q("zipRunStatus").textContent="فشل ربط GitHub: "+(e.message||e);q("zipRunStatus").className="status err";return;}
 }
 const b=q("publishZip");b.disabled=true;
 try{
   q("zipRunStatus").textContent="1/5 إنشاء مستودع جديد…";q("zipRunStatus").className="status";
   const requested=q("project").value.trim()||"codepilot-zip-project";
   const repo=await createZipRepo(requested);
   const full=repo.full_name;
   const files=generatedFiles.filter(f=>f.path && !/^\.github\//.test(f.path));
   if(!files.length)throw new Error("لا توجد ملفات قابلة للنشر.");
   for(let i=0;i<files.length;i++){
     const file=files[i];
     q("zipRunStatus").textContent="2/5 رفع الملفات: "+(i+1)+"/"+files.length;
     await authedJson(apiBase+"/repos/"+full+"/contents/"+file.path.split("/").map(encodeURIComponent).join("/"),{
       method:"PUT",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({message:"CodePilot ZIP: "+file.path,content:btoa(unescape(encodeURIComponent(file.content))),branch:"main"})
     });
   }
   q("zipRunStatus").textContent="3/5 إضافة محرك البناء والنشر…";
   const wf=zipPagesWorkflow(repo.name);
   await authedJson(apiBase+"/repos/"+full+"/contents/.github/workflows/deploy-pages.yml",{
     method:"PUT",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({message:"Add GitHub Pages build workflow",content:btoa(unescape(encodeURIComponent(wf))),branch:"main"})
   });
   q("zipRunStatus").textContent="4/5 تفعيل GitHub Pages…";
   const pagesUrl=apiBase+"/repos/"+full+"/pages";
   const pr=await fetch(pagesUrl,{method:"POST",headers:{...githubHeaders(),"Content-Type":"application/json"},body:JSON.stringify({build_type:"workflow",source:{branch:"main",path:"/"}})});
   if(!pr.ok && pr.status!==409){
     const pd=await pr.json().catch(()=>({}));
     throw new Error("فشل تفعيل Pages: "+(pd.message||("HTTP "+pr.status)));
   }
   q("repoUrl").value=repo.html_url;
   const publicUrl="https://"+repo.owner.login+".github.io/"+repo.name+"/";
   q("publicSiteLink").href=publicUrl;q("publicSiteLink").textContent=publicUrl;q("publicSite").style.display="block";
   q("zipRunStatus").textContent="5/5 تم الرفع. ننتظر Build وPages…";
   const deadline=Date.now()+8*60*1000;
   let done=false;
   while(Date.now()<deadline){
     const runs=await authedJson(apiBase+"/repos/"+full+"/actions/workflows/deploy-pages.yml/runs?per_page=5");
     const run=(runs.workflow_runs||[])[0];
     if(run){
       if(run.status==="completed"){
         done=run.conclusion==="success";
         if(!done)throw new Error("فشل Build/Pages. افتح Actions في "+repo.html_url);
         break;
       }
       q("zipRunStatus").textContent="Build يعمل الآن: "+run.status+"…";
     }
     await new Promise(r=>setTimeout(r,5000));
   }
   if(!done)throw new Error("انتهت مهلة Build. المستودع موجود ويمكن متابعة Actions من الرابط.");
   q("zipRunStatus").textContent="نجح التشغيل الفعلي ✓ تم بناء المشروع ونشره على GitHub Pages.";
   q("zipRunStatus").className="status ok";
   await loadRepository();
 }catch(e){
   q("zipRunStatus").textContent="فشل التشغيل الفعلي: "+(e.message||e);
   q("zipRunStatus").className="status err";
 }finally{b.disabled=false;}
}
q("publishZip").onclick=publishZipProject;

q("zipInput").onchange=async()=>{
 const file=q("zipInput").files[0]; if(!file)return;
 const s=q("zipStatus");s.textContent="جارٍ فك ZIP وفحص الملفات...";s.className="status";
 try{await loadZipProject(file);s.textContent="تم فتح المشروع من ZIP ✓";s.className="status ok";}
 catch(e){s.textContent="فشل فتح ZIP: "+(e.message||e);s.className="status err";}
};

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
 const htmlFile=generatedFiles.find(f=>normalizePath(f.path)==="index.html"||normalizePath(f.path).endsWith("/index.html"));
 if(!htmlFile){
   frame.srcdoc="<body style='font-family:system-ui;padding:20px'><h3>لا توجد index.html</h3><p>المعاينة الحالية مخصصة لمشاريع الويب.</p></body>";
   return;
 }

 const map=new Map(generatedFiles.map(f=>[normalizePath(f.path),f]));
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
  generatedFiles.forEach(f=>zip.file(normalizePath(f.path),f.content));
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
  // Accept a pasted GitHub link even when the user copied surrounding text,
  // omitted https://, used www.github.com, or included a trailing punctuation mark.
  let raw=String(value||"").trim();
  const match=raw.match(/https?:\/\/[^\s<>"']+|(?:www\.)?github\.com\/[^\s<>"']+|[a-z0-9-]+\.github\.io\/[^\s<>"']+/i);
  if(match)raw=match[0];
  if(!/^https?:\/\//i.test(raw))raw="https://"+raw;
  raw=raw.replace(/[),.;!?]+$/,"");
  const u=new URL(raw);
  const host=u.hostname.toLowerCase();

  if(host==="github.com" || host==="www.github.com"){
    const parts=u.pathname.split("/").filter(Boolean);
    if(parts.length<2)return null;
    const owner=parts[0].trim();
    const repo=parts[1].replace(/\.git$/,"").trim();
    if(!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo))return null;
    return {owner,repo};
  }

  // Also accept a public GitHub Pages URL:
  // https://OWNER.github.io/REPO
  const m=host.match(/^([a-z0-9-]+)\.github\.io$/i);
  if(m){
    const parts=u.pathname.split("/").filter(Boolean);
    if(parts.length<1)return null;
    const repo=parts[0].replace(/\.git$/,"").trim();
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
 const button=q("loadRepo");button.disabled=true;q("loadStatus").textContent="جارٍ قراءة المستودع...";q("loadStatus").className="status";
 try{
  const repo=await githubJson("https://api.github.com/repos/"+encodeURIComponent(parsed.owner)+"/"+encodeURIComponent(parsed.repo));
  const branch=repo.default_branch||"main";
  const tree=await githubJson("https://api.github.com/repos/"+parsed.owner+"/"+parsed.repo+"/git/trees/"+encodeURIComponent(branch)+"?recursive=1");
  if(tree.truncated)throw new Error("المستودع كبير جداً للتحميل المباشر؛ افتح المستودع أو حمّل الملفات على دفعات.");
  const candidates=(tree.tree||[]).filter(x=>x.type==="blob"&&!x.path.startsWith(".git/")&&!/(^|\/)(node_modules|dist|build|\.next|\.git)(\/|$)/.test(x.path)).slice(0,100);
  if(!candidates.length)throw new Error("لم نجد ملفات نصية قابلة للعرض.");
  generatedFiles=[];
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


q("publishCode").onclick=publishCodeToGitHub;
q("downloadProject").onclick=downloadProjectZip;
