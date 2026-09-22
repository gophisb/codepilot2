/* CodePilot2 runtime — isolated boot layer */
"use strict";
window.addEventListener("error",function(e){try{const el=document.getElementById("status");if(el){el.textContent="خطأ JavaScript: "+(e.message||"Unknown error");el.className="status err";}}catch(_) {}});
window.addEventListener("unhandledrejection",function(e){try{const el=document.getElementById("status");if(el){el.textContent="خطأ تشغيل: "+(e.reason?.message||String(e.reason||"Unknown error"));el.className="status err";}}catch(_) {}});
window.addEventListener("error",function(e){var p=document.createElement("pre");p.textContent="CodePilot Preview Error: "+(e.message||"Unknown error");p.style.cssText="white-space:pre-wrap;background:#fee;color:#900;padding:12px;font:14px system-ui";document.body.insertBefore(p,document.body.firstChild)});<\/script>`;
 html=html.replace(/<head([^>]*)>/i,"<head$1>"+bridge);
 frame.srcdoc=html;
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
renderGithubState();verifyGithubSession();
q("prompt").addEventListener("touchstart",()=>q("prompt").focus(),{passive:true});
q("codeView").addEventListener("touchstart",()=>q("codeView").focus(),{passive:true});

