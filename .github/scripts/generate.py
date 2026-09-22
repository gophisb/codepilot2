import os,json,urllib.request,urllib.parse,urllib.error,pathlib,re,shutil,time

provider=os.environ["PROVIDER"].strip().lower()
prompt=os.environ["PROMPT"].strip()
stack=os.environ["STACK"].strip()
platform=os.environ["PLATFORM"].strip()
project=os.environ["PROJECT"].strip()
keys={
  "gemini":os.environ.get("GEMINI_API_KEY",""),
  "deepseek":os.environ.get("DEEPSEEK_API_KEY",""),
  "openai":os.environ.get("OPENAI_API_KEY",""),
  "openrouter":os.environ.get("OPENROUTER_API_KEY","")
}

system="""You are CodePilot, an engineering agent that builds runnable software.
Return ONLY JSON matching this exact shape:
{"files":[{"path":"relative/path","content":"full file content"}],"summary":"short summary"}.
Generate a complete runnable project. Use safe relative paths. Never include secrets.
Do not create .github files. Avoid unnecessary dependencies. Respect the requested stack and platform.
For web/PWA projects, include a complete index.html and all required local CSS/JS files.\n          Keep generated projects compact: prefer 4-12 files and avoid unnecessarily large source files.
"""

user=f"Request: {prompt}\nStack: {stack}\nPlatform: {platform}\nProject: {project}"

def post(url,payload,headers):
  req=urllib.request.Request(
    url,
    data=json.dumps(payload).encode(),
    headers={"Content-Type":"application/json","Accept":"application/json",**headers},
    method="POST"
  )
  try:
    with urllib.request.urlopen(req,timeout=180) as r:
      return json.loads(r.read().decode())
  except urllib.error.HTTPError as e:
    body=e.read().decode("utf-8","replace")
    raise RuntimeError(f"HTTP {e.code}: {body[:1500]}")
  except Exception as e:
    raise RuntimeError(str(e))

def call_gemini():
  key=keys["gemini"]
  if not key: raise RuntimeError("GEMINI_API_KEY is missing")
  url="https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
  schema={
    "type":"OBJECT",
    "properties":{
      "files":{
        "type":"ARRAY",
        "items":{
          "type":"OBJECT",
          "properties":{"path":{"type":"STRING"},"content":{"type":"STRING"}},
          "required":["path","content"]
        }
      },
      "summary":{"type":"STRING"}
    },
    "required":["files","summary"]
  }
  payload={
    "systemInstruction":{"parts":[{"text":system}]},
    "contents":[{"role":"user","parts":[{"text":user}]}],
    "generationConfig":{
      "responseMimeType":"application/json",
      "responseSchema":schema,
      "maxOutputTokens":16000,
      "thinkingConfig":{"thinkingLevel":"medium"}
    }
  }
  data=post(url,payload,{"x-goog-api-key":key})
  try:
    return data["candidates"][0]["content"]["parts"][0]["text"]
  except (KeyError,IndexError,TypeError) as e:
    raise RuntimeError("Gemini returned no usable candidate: "+str(e))

def call_openrouter():
  key=keys["openrouter"]
  if not key: raise RuntimeError("OPENROUTER_API_KEY is missing")
  last=None
  for attempt in range(1,4):
    try:
      data=post("https://openrouter.ai/api/v1/chat/completions",{
        "model":"openrouter/free",
        "messages":[{"role":"system","content":system},{"role":"user","content":user}],
        "temperature":0.1,
        "max_tokens":16000
      },{
        "Authorization":"Bearer "+key,
        "HTTP-Referer":"https://gophisb.github.io/codepilot2/",
        "X-Title":"CodePilot2-gophisb"
      })
      content=data["choices"][0]["message"]["content"]
      if not isinstance(content,str) or not content.strip():
        raise RuntimeError("OpenRouter returned empty content")
      finish=(data.get("choices",[{}])[0].get("finish_reason") or "").lower()
      if finish in ("length","max_tokens"):
        raise RuntimeError("OpenRouter output was truncated (finish_reason="+finish+")")
      return content
    except Exception as e:
      last=e
      print(f"OpenRouter attempt {attempt}/3 failed: {str(e)[:900]}")
      if attempt<3:
        time.sleep(4*attempt)
  raise RuntimeError("OpenRouter failed after 3 attempts: "+str(last))

def call_chat(name):
  key=keys.get(name)
  if not key: raise RuntimeError(name.upper()+"_API_KEY is missing")
  urls={"deepseek":"https://api.deepseek.com/chat/completions","openai":"https://api.openai.com/v1/chat/completions"}
  models={"deepseek":"deepseek-chat","openai":"gpt-4o"}
  data=post(urls[name],{
    "model":models[name],
    "messages":[{"role":"system","content":system},{"role":"user","content":user}],
    "temperature":0.1,"max_tokens":16000
  },{"Authorization":"Bearer "+key})
  try:return data["choices"][0]["message"]["content"]
  except (KeyError,IndexError,TypeError) as e:raise RuntimeError(name+" invalid response: "+str(e))

if provider=="gemini":
  text=None
  first=None
  for attempt in range(1,3):
    try:
      text=call_gemini()
      used_model="gemini-3.8-flash"
      break
    except Exception as e:
      first=e
      print(f"Gemini attempt {attempt}/2 failed: {str(e)[:900]}")
      if attempt<2:
        time.sleep(5)
  if text is None:
    print("Gemini unavailable; trying OpenRouter fallback: "+str(first)[:900])
    text=call_openrouter()
    used_model="openrouter/free"
elif provider=="openrouter":
  text=call_openrouter();used_model="openrouter/free"
elif provider in ("deepseek","openai"):
  text=call_chat(provider);used_model={"deepseek":"deepseek-chat","openai":"gpt-4o"}[provider]
else:
  raise SystemExit("Unsupported provider: "+provider)

def parse_model_json(raw):
  if not isinstance(raw,str) or not raw.strip():
    raise SystemExit("Model returned empty output")
  cleaned=raw.strip()
  if cleaned.startswith("\\`\\`\\`"):
    cleaned=re.sub(r"^\\`\\`\\`(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned=re.sub(r"\\s*\\`\\`\\`$", "", cleaned)
  candidates=[cleaned]
  a,b=cleaned.find("{"),cleaned.rfind("}")
  if a>=0 and b>a:
    candidates.append(cleaned[a:b+1])
  last=None
  for candidate in candidates:
    try:
      return json.loads(candidate, strict=False)
    except json.JSONDecodeError as e:
      last=e
  raise SystemExit("Model returned invalid JSON: "+str(last))

result=parse_model_json(text)

files=result.get("files")
if not isinstance(files,list) or not 1<=len(files)<=40:
  raise SystemExit("Invalid file count")
root=pathlib.Path("generated-project")
if root.exists():shutil.rmtree(root)
root.mkdir()

for item in files:
  if not isinstance(item,dict): raise SystemExit("Invalid file entry")
  path=str(item.get("path",""))
  content=item.get("content","")
  if not isinstance(content,str): raise SystemExit("File content must be text")
  if not re.fullmatch(r"[A-Za-z0-9._/-]+",path) or path.startswith("/") or ".." in path or path in (".github",".git") or path.startswith(".github/") or path.startswith(".git/") or len(path)>240:
    raise SystemExit("Invalid file path: "+path)
  if len(content)>800000: raise SystemExit("File too large: "+path)
  target=root/path
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_text(content,encoding="utf-8")

pathlib.Path("generation-summary.md").write_text(
  "# CodePilot2-gophisb generation\n\nProvider: "+used_model+"\n\n"+str(result.get("summary",""))+"\n",
  encoding="utf-8"
)
pathlib.Path("generation-meta.json").write_text(json.dumps({
  "project":project,"provider":provider,"model":used_model,"stack":stack,"platform":platform,
  "file_count":len(files)
},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Generated",len(files),"files with",used_model)
