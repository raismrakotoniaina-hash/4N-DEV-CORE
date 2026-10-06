const API=location.origin;
let key=localStorage.getItem("4ndev_api_key")||"",me=null,currentProject=null,currentFiles=[],lastBuilderPlan=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("fr-FR").format(Number(n||0));
async function api(path,opt={}){
  const headers={"Content-Type":"application/json",...(opt.headers||{})};
  if(key)headers.Authorization="Bearer "+key;
  const r=await fetch(API+path,{...opt,headers});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.error||d.message||("HTTP "+r.status));
  return d;
}
function showOnboarding(msg=""){
  $("#consoleScreen").classList.add("hidden");$("#onboardingScreen").classList.remove("hidden");
  if(msg){$("#createKeyError").textContent=msg;$("#createKeyError").classList.remove("hidden")}
}
async function refreshMe(){
  me=(await api("/v1/me")).developer;
  $("#planBadge").textContent=(me.plan||"free").toUpperCase();
  $("#creditBadge").textContent=money(me.credits)+" credits";
  $("#workspaceName").textContent=me.name||"Developer";
}
function showConsole(){show("overview");refreshMe().catch(e=>{key="";localStorage.removeItem("4ndev_api_key");showOnboarding(e.message)})}
async function createDeveloperKey(){
  const b=$("#createKeyBtn"),name=$("#developerName").value.trim();
  $("#createKeyError").classList.add("hidden");
  if(!name){$("#createKeyError").textContent="Developer name is required.";$("#createKeyError").classList.remove("hidden");return}
  b.disabled=true;b.innerHTML="<span>Creating API key…</span><b>•</b>";
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    const r=await fetch(API+"/v1/keys/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name}),signal:controller.signal});
    clearTimeout(timer);
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw new Error(d.error||("HTTP "+r.status));
    key=d.api_key;
    $("#createdApiKey").value=key;$("#createKeyStep").classList.add("hidden");$("#keyCreatedStep").classList.remove("hidden");
    sessionStorage.setItem("4ndev_new_api_key",key);
  }catch(e){
    $("#createKeyError").textContent=e.name==="AbortError"?"Request timed out. Please try again.":(e.message||"Unable to create API key.");
    $("#createKeyError").classList.remove("hidden");
  }finally{b.disabled=false;b.innerHTML="<span>Create API key</span><b>→</b>"}
}
async function copyCreatedKey(){
  const v=$("#createdApiKey").value;if(!v)return;
  try{await navigator.clipboard.writeText(v)}catch{$("#createdApiKey").select();document.execCommand("copy")}
  $("#copyStatus").textContent="API key copied to clipboard.";
}
function continueToConsole(){localStorage.setItem("4ndev_api_key",key);sessionStorage.removeItem("4ndev_new_api_key");$("#onboardingScreen").classList.add("hidden");$("#consoleScreen").classList.remove("hidden");showConsole()}
function logoutDeveloper(){key="";me=null;localStorage.removeItem("4ndev_api_key");sessionStorage.removeItem("4ndev_new_api_key");showOnboarding()}
const pages={overview,models,playground,apiKeys,projects,usage,builder,docs,billing,settings};
function show(p){
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===p));
  const v=pages[p]||overview;$("#main").innerHTML=v();bind(p);$("#sidebar").classList.remove("open");
}
function title(t,s,actions=""){return '<div class="page-title"><div><h1>'+t+'</h1><p class="muted">'+s+'</p></div><div class="page-actions">'+actions+"</div></div>"}
function overview(){
  return title("Overview","Your 4N DEV workspace at a glance.")+
  '<div class="hero-panel"><div class="card"><span class="eyebrow">DEVELOPER CONSOLE</span><h2>Ship faster with 4N DEV.</h2><p class="muted">Use one API for AI models, application projects and the 4N DEV Builder. Start in the Playground, then move your integration to production.</p><div class="toolbar" style="margin-top:18px"><button class="primary" data-go="playground">Open Playground →</button><button class="ghost" data-go="docs">Read docs</button></div></div><div class="card"><div class="stat-label"><span>Workspace</span><span class="badge green">ONLINE</span></div><div style="font-size:18px;font-weight:750;margin-top:10px">'+esc(me?.name||"Developer")+'</div><p class="muted small">Plan: '+esc((me?.plan||"free").toUpperCase())+' · '+money(me?.credits)+' credits available</p><div class="endpoint">https://fourn-dev-core.onrender.com/v1</div></div></div>'+
  '<div class="section"><div class="section-head"><h2>Workspace metrics</h2></div><div class="grid4">'+
  stat("Credits remaining",money(me?.credits),"Available for API calls","✦")+stat("Plan",(me?.plan||"free").toUpperCase(),"Current developer plan","◆")+stat("API features",me?.features?.length||0,"Enabled capabilities","◈")+stat("Authentication","Active","Connected API key","⌁")+
  '</div></div>'+
  '<div class="section"><div class="section-head"><h2>Start building</h2><button class="ghost" data-go="docs">Documentation →</button></div><div class="grid3">'+
  actionCard("✦","Models","Explore Chat, Coding, Image and Embeddings.","models","Explore models")+actionCard("◈","Projects","Create files, build applications and deploy them.","projects","Open projects")+actionCard("◇","Builder","Describe an app and let the Core Builder generate it.","builder","Open Builder")+
  '</div></div>'+
  '<div class="section"><div class="section-head"><h2>Quick API example</h2></div><div class="card"><div class="code">curl https://fourn-dev-core.onrender.com/v1/chat \\\n  -H "Authorization: Bearer 4ndev_sk_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"input":"Hello from 4N DEV"}'</div></div></div>';
}
function stat(label,value,foot,icon){return '<div class="card stat-card"><div class="stat-label"><span>'+label+'</span><span>'+icon+'</span></div><div class="stat-value">'+esc(value)+'</div><div class="stat-foot">'+foot+'</div></div>'}
function actionCard(icon,name,desc,page,cta){return '<div class="card"><div class="model-icon">'+icon+'</div><h3>'+name+'</h3><p class="muted small">'+desc+'</p><button class="ghost" data-go="'+page+'" type="button">'+cta+' →</button></div>'}
function models(){
  const items=[
    ["✦","Chat","gpt-5.6-luna / 4n-dev-demo-chat","General purpose conversational AI.","/v1/chat","1 credit"],
    ["⌘","Coding","gpt-5.6-luna / 4n-dev-demo-coding","Code generation and programming assistance.","/v1/coding","5 credits"],
    ["◉","Image","gpt-image-2 / 4n-dev-demo-image","AI image generation.","/v1/image","10–50 credits"],
    ["◈","Embeddings","text-embedding-3-small / 4n-dev-demo-embedding","Vector embeddings for search and retrieval.","/v1/embeddings","1 credit"]
  ];
  return title("Models","AI capabilities exposed by 4N DEV Core.")+
  '<div class="grid2">'+items.map(x=>'<div class="card model-card"><div class="model-icon">'+x[0]+'</div><h3>'+x[1]+'</h3><div class="model-id">'+x[2]+'</div><p class="muted">'+x[3]+'</p><span class="tag">'+x[4]+'</span><span class="tag">'+x[5]+'</span><div style="margin-top:14px"><button class="ghost use-model" data-model="'+x[1].toLowerCase()+'">Try in Playground →</button></div></div>').join("")+'</div>'+
  '<div class="section"><div class="section-head"><h2>API endpoints</h2></div><div class="card"><table class="table"><thead><tr><th>Capability</th><th>Method</th><th>Endpoint</th><th>Auth</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+x[1]+'</td><td>POST</td><td class="endpoint">'+x[4]+'</td><td><span class="pill ok">Bearer key</span></td></tr>').join("")+'</tbody></table></div></div>';
}
function playground(){
  return title("Playground","Send authenticated requests to 4N DEV Core without leaving the console.")+
  '<div class="grid2"><div class="card stack"><div class="section-head" style="margin:0"><h2>Request</h2><span class="pill ok">Authenticated</span></div><label class="small muted">Model capability</label><select id="playModel"><option value="chat">Chat</option><option value="coding">Coding</option><option value="image">Image</option><option value="embeddings">Embeddings</option></select><label class="small muted">Input</label><textarea id="playInput" rows="11" placeholder="Write a prompt or coding request…"></textarea><button id="playRun" class="primary" type="button">Run request →</button></div><div class="card"><div class="section-head" style="margin:0 0 10px"><h2>Response</h2><span id="playState" class="pill">Ready</span></div><div id="playOutput" class="output">Your model response will appear here.</div></div></div>';
}
function apiKeys(){
  const masked=key?key.slice(0,12)+"••••••••••••"+key.slice(-4):"—";
  return title("API Keys","Manage the secret used to authenticate this developer console.")+
  '<div class="card"><div class="section-head" style="margin:0"><div><h2>Active secret</h2><p class="muted small">Created during developer onboarding.</p></div><span class="pill ok">ACTIVE</span></div><div class="key-display" style="margin-top:16px">'+esc(masked)+'</div><div class="toolbar" style="margin-top:12px"><button id="copyKey" class="ghost">Copy key</button><button id="forgetKey" class="danger">Remove from this device</button></div></div>'+
  '<div class="section"><div class="section-head"><h2>Security</h2></div><div class="grid2"><div class="card"><h3>Server-side usage</h3><p class="muted small">Store your secret in an environment variable such as <code>FOURN_DEV_API_KEY</code>. Do not ship it in frontend JavaScript.</p></div><div class="card"><h3>Authentication</h3><div class="endpoint">Authorization: Bearer 4ndev_sk_...</div><p class="muted small">Every protected Core API request is authenticated with your developer key.</p></div></div></div>';
}
function projects(){
  return title("Projects","Applications, files and deployments managed through 4N DEV Core.",
  '<button class="primary" id="newProjectTop">+ New project</button>')+
  '<div class="card"><div class="toolbar"><input id="newProjectName" class="field" style="max-width:300px" placeholder="Project name"><button id="newProject" class="primary">Create</button><button id="reloadProjects" class="ghost">Refresh</button></div><div id="projectList" style="margin-top:14px">Loading projects…</div></div><div id="projectWorkspace" class="hidden" style="margin-top:13px"></div>';
}
function usage(){
  return title("Usage","Monitor API activity and credit consumption.")+
  '<div class="grid3">'+stat("Credits remaining",money(me?.credits),"Current balance","✦")+stat("Plan",(me?.plan||"free").toUpperCase(),"Current plan","◆")+'<div class="card stat-card"><div class="stat-label"><span>API status</span><span class="badge green">ONLINE</span></div><div class="stat-value">Healthy</div><div class="stat-foot">4N DEV Core API</div></div></div>'+
  '<div class="section"><div class="section-head"><h2>Recent activity</h2><button id="refreshUsage" class="ghost">Refresh</button></div><div class="card"><div id="usageList">Loading usage…</div></div></div>';
}
function builder(){
  return title("Builder","Turn an app description into a project, then review, build and deploy it.")+
  '<div class="grid2"><div class="card stack"><div class="section-head" style="margin:0"><h2>Build brief</h2><span class="pill">Core Builder</span></div><input id="projectName" class="field" placeholder="Project name (optional)"><textarea id="builderPrompt" rows="12" placeholder="Example: Build a small business website with Dashboard, Clients, Invoices and Settings…"></textarea><div class="toolbar"><button id="planBtn" class="ghost">1. Prepare plan</button><button id="buildBtn" class="primary">2. Generate + Build →</button></div><span id="builderStatus" class="status"></span></div><div class="card"><div class="section-head" style="margin:0 0 10px"><h2>Builder output</h2></div><div id="planOutput" class="output hidden"></div><div id="buildOutput" class="output">Your generated plan and build results will appear here.</div></div></div>';
}
function docs(){
  return title("Documentation","Start with authentication, models and the Core API.")+
  '<div class="grid3">'+actionCard("01","Authentication","Send your API key as a Bearer token.","apiKeys","View API key")+actionCard("02","Models","Choose Chat, Coding, Image or Embeddings.","models","View models")+actionCard("03","Projects","Create, edit, build and deploy application files.","projects","View projects")+'</div>'+
  '<div class="section"><div class="section-head"><h2>First request</h2><span class="pill">POST /v1/chat</span></div><div class="card"><div class="code">curl https://fourn-dev-core.onrender.com/v1/chat \\\n  -H "Authorization: Bearer 4ndev_sk_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"input":"Hello 4N DEV"}'</div></div></div>'+
  '<div class="section"><div class="section-head"><h2>Core API surface</h2></div><div class="card"><table class="table"><tbody><tr><td>Chat</td><td class="endpoint">POST /v1/chat</td></tr><tr><td>Coding</td><td class="endpoint">POST /v1/coding</td></tr><tr><td>Image</td><td class="endpoint">POST /v1/image</td></tr><tr><td>Embeddings</td><td class="endpoint">POST /v1/embeddings</td></tr><tr><td>Projects</td><td class="endpoint">/v1/projects</td></tr><tr><td>Usage</td><td class="endpoint">GET /v1/usage</td></tr></tbody></table></div></div>';
}
function billing(){
  return title("Billing","Plans, credits and developer payments.")+
  '<div class="grid3">'+stat("Current plan",(me?.plan||"free").toUpperCase(),"Developer plan","◆")+stat("Credits",money(me?.credits),"Remaining balance","✦")+stat("Currency","MGA","Malagasy Ariary","◇")+'</div>'+
  '<div class="section"><div class="section-head"><h2>Available plans</h2></div><div id="plans" class="grid3">Loading plans…</div></div>'+
  '<div class="section"><div class="section-head"><h2>Orders</h2></div><div class="card"><div id="orders">Loading orders…</div></div></div>';
}
function settings(){
  return title("Settings","Developer account, access and local console preferences.")+
  '<div class="grid2"><div class="card"><div class="section-head" style="margin:0"><h2>Developer account</h2><span class="pill ok">ACTIVE</span></div><div class="settings-row"><span>Name</span><b>'+esc(me?.name||"—")+'</b></div><div class="settings-row"><span>Account ID</span><b>'+esc(me?.id||"—")+'</b></div><div class="settings-row"><span>Plan</span><b>'+esc(me?.plan||"—")+'</b></div><div class="settings-row"><span>Credits</span><b>'+esc(me?.credits??"—")+'</b></div><div class="settings-row"><span>Scopes</span><b>'+esc((me?.scopes||[]).join(", ")||"—")+'</b></div></div><div class="card"><h2>Security</h2><p class="muted small">Your connected secret is stored in this browser only when you continue into the console. It is never sent to the UI as plain text by the account endpoint.</p><button id="settingsLogout" class="danger">Disconnect this device</button></div></div>';
}
function bind(p){
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.go)));
  if(p==="models")document.querySelectorAll(".use-model").forEach(b=>b.addEventListener("click",()=>{show("playground");setTimeout(()=>{$("#playModel").value=b.dataset.model},0)}));
  if(p==="playground")$("#playRun").addEventListener("click",runPlayground);
  if(p==="apiKeys"){$("#copyKey").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(key);alert("API key copied.")}catch{alert("Copy is unavailable on this browser.")}});$("#forgetKey").addEventListener("click",logoutDeveloper)}
  if(p==="projects"){$("#newProject").addEventListener("click",createProjectUI);$("#reloadProjects").addEventListener("click",loadProjects);$("#newProjectTop").addEventListener("click",()=>$("#newProjectName").focus());loadProjects()}
  if(p==="usage"){$("#refreshUsage").addEventListener("click",loadUsage);loadUsage()}
  if(p==="builder"){$("#planBtn").addEventListener("click",planBuilder);$("#buildBtn").addEventListener("click",buildBuilder)}
  if(p==="billing"){loadPlans();loadOrders()}
  if(p==="settings")$("#settingsLogout").addEventListener("click",logoutDeveloper);
}
async function runPlayground(){
  const kind=$("#playModel").value,input=$("#playInput").value.trim();if(!input)return;
  $("#playState").textContent="Running…";$("#playOutput").textContent="Waiting for Core API…";
  try{
    let d;
    if(kind==="image")d=await api("/v1/image",{method:"POST",body:JSON.stringify({prompt:input,quality:"medium"})});
    else d=await api("/v1/"+kind,{method:"POST",body:JSON.stringify({input})});
    $("#playOutput").textContent=d.output||d.text||d.response||JSON.stringify(d,null,2);$("#playState").textContent="Completed";await refreshMe();
  }catch(e){$("#playOutput").textContent="Error: "+e.message;$("#playState").textContent="Error"}
}
async function planBuilder(){
  const p=$("#builderPrompt").value.trim();if(!p)return;
  $("#builderStatus").textContent="Preparing plan…";
  try{const d=await api("/v1/builder/plan",{method:"POST",body:JSON.stringify({prompt:p})});lastBuilderPlan=d.plan||null;$("#planOutput").classList.remove("hidden");$("#planOutput").textContent=JSON.stringify(d.plan,null,2);await refreshMe()}catch(e){$("#planOutput").classList.remove("hidden");$("#planOutput").textContent="Error: "+e.message}finally{$("#builderStatus").textContent=""}
}
async function buildBuilder(){
  const p=$("#builderPrompt").value.trim();if(!p)return;
  $("#builderStatus").textContent="Generating, reviewing, building and deploying…";
  try{
    const d=await api("/v1/builder",{method:"POST",body:JSON.stringify({prompt:p,projectName:$("#projectName").value.trim(),plan:lastBuilderPlan})});
    const url=d.deployment?.url?(d.deployment.url.startsWith("http")?d.deployment.url:API+d.deployment.url):"";
    $("#buildOutput").innerHTML='<div class="notice"><b>'+esc(d.summary||"Project generated")+'</b><br><br>Build: '+esc(d.build?.status||"—")+' · Files: '+esc(d.files?.length||0)+' · Review: '+(d.review?.passed?"passed":"failed")+(url?'<br><br><a class="link" href="'+esc(url)+'" target="_blank">Open deployed site →</a>':"")+'</div>';
    await refreshMe();if($("#projectList"))loadProjects();
  }catch(e){$("#buildOutput").textContent="Error: "+e.message}finally{$("#builderStatus").textContent=""}
}
async function loadProjects(){
  try{
    const d=await api("/v1/projects");
    $("#projectList").innerHTML=d.projects?.length?d.projects.map(p=>'<div class="project-row"><div><strong>'+esc(p.name)+'</strong><div class="muted small">'+esc(p.description||"No description")+'</div></div><div class="toolbar"><button class="ghost open-project" data-id="'+esc(p.id)+'">Open</button><button class="danger delete-project" data-id="'+esc(p.id)+'">Delete</button></div></div>').join(""):'<div class="empty">No projects yet. Create your first application above.</div>';
    document.querySelectorAll(".open-project").forEach(b=>b.addEventListener("click",()=>openProject(b.dataset.id)));
    document.querySelectorAll(".delete-project").forEach(b=>b.addEventListener("click",()=>deleteProject(b.dataset.id)));
  }catch(e){$("#projectList").textContent="Error: "+e.message}
}
async function createProjectUI(){
  const name=$("#newProjectName").value.trim();if(!name)return;
  try{await api("/v1/projects",{method:"POST",body:JSON.stringify({name})});$("#newProjectName").value="";loadProjects()}catch(e){alert(e.message)}
}
async function deleteProject(id){
  if(!confirm("Delete this project?"))return;
  try{await api("/v1/projects/"+encodeURIComponent(id),{method:"DELETE"});$("#projectWorkspace").classList.add("hidden");loadProjects()}catch(e){alert(e.message)}
}
async function openProject(id){
  try{const d=await api("/v1/projects/"+encodeURIComponent(id));currentProject=d.project;const f=await api("/v1/projects/"+encodeURIComponent(id)+"/files");currentFiles=f.files||[];renderProjectWorkspace()}catch(e){alert(e.message)}
}
function renderProjectWorkspace(){
  const p=currentProject,w=$("#projectWorkspace");w.classList.remove("hidden");
  w.innerHTML='<div class="card stack"><div class="toolbar"><div style="margin-right:auto"><h3 style="margin:0">'+esc(p.name)+'</h3><span class="muted small">'+esc(p.id)+'</span></div><button id="buildProject" class="ghost">Build</button><button id="deployProject" class="primary">Deploy</button></div><div class="grid2"><div><div class="section-head"><h2>Files</h2></div><div id="fileList">'+(currentFiles.length?currentFiles.map(f=>'<div class="file-row"><button class="ghost file-open" data-id="'+esc(f.id)+'">'+esc(f.path)+'</button><span class="muted small">'+f.content.length+' chars</span></div>').join(""):'<div class="empty">No files.</div>')+'</div></div><div><div class="section-head"><h2>Editor</h2></div><input id="filePath" class="field" placeholder="index.html"><textarea id="fileContent" class="file-editor" placeholder="File content…"></textarea><div class="toolbar" style="margin-top:8px"><button id="saveFile" class="primary">Save file</button><button id="newFile" class="ghost">New file</button></div><div id="fileStatus" class="status"></div></div></div><div id="deployOutput"></div></div>';
  document.querySelectorAll(".file-open").forEach(b=>b.addEventListener("click",()=>editFile(b.dataset.id)));
  $("#saveFile").addEventListener("click",saveFile);$("#newFile").addEventListener("click",()=>{$("#filePath").value="";$("#fileContent").value="";delete $("#saveFile").dataset.id});
  $("#buildProject").addEventListener("click",buildProjectUI);$("#deployProject").addEventListener("click",deployProject);
}
function editFile(id){const f=currentFiles.find(x=>x.id===id);if(f){$("#filePath").value=f.path;$("#fileContent").value=f.content;$("#saveFile").dataset.id=f.id}}
async function saveFile(){
  const path=$("#filePath").value.trim(),content=$("#fileContent").value;if(!path)return;
  try{const id=$("#saveFile").dataset.id;if(id)await api("/v1/projects/"+currentProject.id+"/files/"+id,{method:"PUT",body:JSON.stringify({path,content})});else await api("/v1/projects/"+currentProject.id+"/files",{method:"POST",body:JSON.stringify({path,content})});$("#fileStatus").textContent="Saved.";openProject(currentProject.id)}catch(e){$("#fileStatus").textContent="Error: "+e.message}
}
async function buildProjectUI(){try{const d=await api("/v1/builds",{method:"POST",body:JSON.stringify({projectId:currentProject.id})});$("#deployOutput").innerHTML='<div class="notice">Build '+esc(d.build.status)+' · '+esc(d.build.fileCount)+' files</div>'}catch(e){$("#deployOutput").textContent="Error: "+e.message}}
async function deployProject(){try{const d=await api("/v1/hosting/deployments",{method:"POST",body:JSON.stringify({projectId:currentProject.id})});const url=d.deployment.url.startsWith("http")?d.deployment.url:API+d.deployment.url;$("#deployOutput").innerHTML='<div class="notice">Deployment: '+esc(d.deployment.status)+' — <a class="link" target="_blank" href="'+esc(url)+'">Open site →</a></div>'}catch(e){$("#deployOutput").textContent="Error: "+e.message}}
async function loadUsage(){
  try{
    const d=await api("/v1/usage"),rows=d.usage||[];
    $("#usageList").innerHTML=rows.length?rows.map(x=>'<div class="activity-row"><div><strong>'+esc(x.endpoint||x.service||"API request")+'</strong><div class="muted small">'+esc(x.createdAt||x.timestamp||"")+'</div></div><span class="pill">'+esc(x.credits_used??0)+' credits</span></div>').join(""):'<div class="empty">No usage records yet.</div>';
  }catch(e){$("#usageList").textContent="Error: "+e.message}
}
async function loadPlans(){
  try{
    const d=await api("/v1/billing/plans");
    $("#plans").innerHTML=(d.plans||[]).map(p=>'<div class="card"><span class="pill">'+esc(p.id)+'</span><h3 style="margin:14px 0 0">'+esc(p.name)+'</h3><div class="price">'+money(p.prices?.MGA||0)+' Ar</div><div class="muted small">'+money(p.credits)+' credits / month</div><ul>'+(p.features||[]).map(f=>"<li>"+esc(f)+"</li>").join("")+'</ul>'+(p.id==="free"?"":'<button class="primary buy" data-plan="'+esc(p.id)+'">Choose plan →</button>')+'</div>').join("");
    document.querySelectorAll(".buy").forEach(b=>b.addEventListener("click",()=>startOrder(b.dataset.plan)));
  }catch(e){$("#plans").textContent="Error: "+e.message}
}
async function loadOrders(){
  try{const d=await api("/v1/billing/orders");$("#orders").innerHTML=d.orders?.length?d.orders.map(o=>'<div class="order-row"><div><strong>'+esc(o.planId||o.plan_id)+'</strong><div class="muted small">'+esc(o.currency)+' '+esc(o.amount)+' · '+esc(o.status)+'</div></div><span class="muted small">'+esc(o.id)+'</span></div>').join(""):'<div class="empty">No billing orders yet.</div>'}catch(e){$("#orders").textContent="Error: "+e.message}
}
async function startOrder(planId){
  try{const o=await api("/v1/billing/orders",{method:"POST",body:JSON.stringify({planId,currency:"MGA"})});const c=await api("/v1/billing/orders/"+o.order.id+"/checkout",{method:"POST",body:JSON.stringify({provider:"papi"})});if(c.checkout?.paymentLink)location.href=c.checkout.paymentLink;else alert("Checkout created but no payment link was returned.")}catch(e){alert(e.message)}
}
function initFrontend(){
  const create=$("#createKeyBtn"),copy=$("#copyCreatedKey"),cont=$("#continueConsoleBtn"),logout=$("#logoutBtn"),mobile=$("#mobileNav");
  if(create)create.addEventListener("click",createDeveloperKey);
  if(copy)copy.addEventListener("click",copyCreatedKey);
  if(cont)cont.addEventListener("click",continueToConsole);
  if(logout)logout.addEventListener("click",logoutDeveloper);
  $("#developerName")?.addEventListener("keydown",e=>{if(e.key==="Enter")createDeveloperKey()});
  if(mobile)mobile.addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>show(n.dataset.page)));
  $("#brandHome")?.addEventListener("click",e=>{e.preventDefault();show("overview")});
  if(key)showConsole();else showOnboarding();
}
window.addEventListener("error",e=>console.error("4N DEV frontend error:",e.error||e.message));
document.addEventListener("DOMContentLoaded",initFrontend);
