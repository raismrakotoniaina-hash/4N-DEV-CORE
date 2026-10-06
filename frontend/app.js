"use strict";

const API = location.origin;
let key = localStorage.getItem("4ndev_api_key") || "";
let me = null;
let currentProject = null;
let currentFiles = [];
let lastBuilderPlan = null;
let lastBuild = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));
const money = value => new Intl.NumberFormat("fr-FR").format(Number(value || 0));

async function api(path, options = {}) {
  const headers = {"Content-Type":"application/json", ...(options.headers || {})};
  if (key) headers.Authorization = "Bearer " + key;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 20000);
  try {
    const response = await fetch(API + path, {...options, headers, signal:controller.signal});
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || data.message || ("HTTP " + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toast(message, type="info") {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.className = "toast";
    document.body.appendChild(box);
  }
  box.className = "toast " + type + " show";
  box.textContent = message;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => box.classList.remove("show"), 3600);
}

function setButton(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle("loading", busy);
  button.innerHTML = busy ? "<span>" + busyText + "</span><b>•</b>" : "<span>" + normalText + "</span><b>→</b>";
}

function showOnboarding(message="") {
  $("#consoleScreen").classList.add("hidden");
  $("#onboardingScreen").classList.remove("hidden");
  const error = $("#createKeyError");
  if (error) {
    if (message) {
      error.textContent = message;
      error.classList.remove("hidden");
    } else {
      error.classList.add("hidden");
      error.textContent = "";
    }
  }
}

function focusOnboarding() {
  $("#onboardingCard")?.scrollIntoView({behavior:"smooth", block:"center"});
  setTimeout(() => $("#developerName")?.focus(), 450);
}

async function createDeveloperKey(event) {
  event?.preventDefault();
  const input = $("#developerName");
  const button = $("#createKeyBtn");
  const error = $("#createKeyError");
  const name = input?.value.trim() || "";

  if (error) {
    error.textContent = "";
    error.classList.add("hidden");
  }

  if (!name) {
    if (error) {
      error.textContent = "Developer or company name is required.";
      error.classList.remove("hidden");
    }
    input?.focus();
    return false;
  }

  setButton(button, true, "Creating API key…", "Create API key");

  try {
    const data = await api("/v1/keys/create", {
      method:"POST",
      body:JSON.stringify({name}),
      timeout:15000
    });

    if (!data.api_key) {
      const missing = new Error("The Core API did not return an API key.");
      missing.status = 502;
      throw missing;
    }

    key = data.api_key;
    sessionStorage.setItem("4ndev_new_api_key", key);
    $("#createdApiKey").value = key;
    $("#createKeyStep").classList.add("hidden");
    $("#keyCreatedStep").classList.remove("hidden");
    $("#copyStatus").textContent = "Key created successfully.";
    toast("Developer API key created.", "success");
  } catch (error) {
    console.error("4N DEV onboarding error", error);

    let message = error.message || "Unable to create API key.";

    if (error.status === 503 && error.data?.code === "DATABASE_NOT_CONFIGURED") {
      message = "Developer key creation is temporarily unavailable. 4N DEV needs its dedicated PostgreSQL database before it can create a persistent API key.";
    } else if (error.status === 429) {
      message = "Too many key-creation attempts. Please wait a few minutes and try again.";
    } else if (error.status === 404) {
      message = "The onboarding API route is not available on this deployment. Please redeploy the latest 4N DEV Core version.";
    } else if (error.status === 401) {
      message = "This deployment is still serving an older onboarding version. Please redeploy the latest 4N DEV Core version.";
    } else if (/fetch/i.test(message) || error.name === "TypeError") {
      message = "The 4N DEV Core API could not be reached. Check the deployment and try again.";
    }

    const errorBox = $("#createKeyError");
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }
    toast(message, "error");
  } finally {
    setButton(button, false, "", "Create API key");
  }

  return false;
}


window.__4nCreateKeyNow = createDeveloperKey;

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

async function copyCreatedKey() {
  const value = $("#createdApiKey")?.value || "";
  if (!value) return;
  const ok = await copyText(value);
  $("#copyStatus").textContent = ok ? "API key copied to clipboard." : "Copy failed. Press and hold the key to copy it manually.";
  toast(ok ? "API key copied." : "Copy failed.", ok ? "success" : "error");
}

function continueToConsole() {
  if (!key) key = sessionStorage.getItem("4ndev_new_api_key") || "";
  if (!key) return toast("No API key is available yet.", "error");
  localStorage.setItem("4ndev_api_key", key);
  sessionStorage.removeItem("4ndev_new_api_key");
  $("#onboardingScreen").classList.add("hidden");
  $("#consoleScreen").classList.remove("hidden");
  showConsole();
}

function logoutDeveloper() {
  key = "";
  me = null;
  localStorage.removeItem("4ndev_api_key");
  sessionStorage.removeItem("4ndev_new_api_key");
  showOnboarding();
  toast("Disconnected from this device.");
}

async function refreshMe() {
  const data = await api("/v1/me");
  me = data.developer || null;
  if (!me) throw new Error("Developer account was not returned.");
  $("#planBadge").textContent = String(me.plan || "free").toUpperCase();
  $("#creditBadge").textContent = money(me.credits) + " credits";
  $("#workspaceName").textContent = me.name || "Developer";
  return me;
}

function showConsole() {
  show("overview");
  refreshMe().catch(error => {
    console.error(error);
    logoutDeveloper();
    showOnboarding("This API key is no longer valid. Create a new developer key.");
  });
}

function title(titleText, subtitle, actions="") {
  return '<div class="page-title"><div><span class="eyebrow">4N DEV / CONSOLE</span><h1>'+esc(titleText)+'</h1><p class="muted">'+esc(subtitle)+'</p></div><div class="page-actions">'+actions+'</div></div>';
}

function stat(label, value, foot, icon) {
  return '<div class="card stat-card"><div class="stat-label"><span>'+esc(label)+'</span><span class="stat-icon">'+icon+'</span></div><div class="stat-value">'+esc(value)+'</div><div class="stat-foot">'+esc(foot)+'</div></div>';
}

function actionCard(icon, name, description, page, cta) {
  return '<div class="card action-card"><div class="model-icon">'+icon+'</div><h3>'+esc(name)+'</h3><p class="muted small">'+esc(description)+'</p><button class="ghost" data-go="'+page+'" type="button">'+esc(cta)+' →</button></div>';
}

function overview() {
  const features = (me?.features || []).map(esc).join(" · ") || "chat · coding · image · embeddings";
  return title("Overview","Your developer workspace, API access and application infrastructure.",
    '<button class="ghost" data-go="docs">Read documentation →</button>') +
  '<div class="hero-panel"><div class="card hero-card"><span class="eyebrow">DEVELOPER PLATFORM</span><h2>Build with the 4N DEV Core.</h2><p class="muted">Connect your application to AI models, create projects, generate applications with Builder, deploy sites and monitor credit usage from one console.</p><div class="toolbar hero-tools"><button class="primary" data-go="playground">Open Playground →</button><button class="ghost" data-go="models">Explore Models</button></div><div class="feature-line">'+features+'</div></div><div class="card status-card"><div class="status-head"><span>Workspace status</span><span class="badge green">ONLINE</span></div><h3>'+esc(me?.name || "Developer")+'</h3><p class="muted small">'+esc((me?.plan || "free").toUpperCase())+' plan · '+money(me?.credits)+' credits</p><div class="endpoint">https://fourn-dev-core.onrender.com/v1</div><div class="mini-status"><i></i> Core API responding</div></div></div>' +
  '<div class="section"><div class="section-head"><div><h2>Workspace overview</h2><p class="muted small">Your current developer resources.</p></div></div><div class="grid4">'+
  stat("Credits",money(me?.credits),"Available balance","✦")+
  stat("Plan",(me?.plan || "free").toUpperCase(),"Developer plan","◆")+
  stat("Capabilities",me?.features?.length || 0,"Enabled API features","◈")+
  stat("Authentication","Active","Bearer API key","⌁")+
  '</div></div>' +
  '<div class="section"><div class="section-head"><div><h2>Build workflow</h2><p class="muted small">From first API request to production deployment.</p></div></div><div class="workflow"><div><b>01</b><strong>Connect</strong><span>Create a key and authenticate.</span></div><div><b>02</b><strong>Build</strong><span>Use models, projects or Builder.</span></div><div><b>03</b><strong>Deploy</strong><span>Build and publish your application.</span></div><div><b>04</b><strong>Operate</strong><span>Monitor usage, credits and billing.</span></div></div></div>' +
  '<div class="section"><div class="section-head"><h2>Quick start</h2></div><div class="card code-card"><div class="code-tabs"><span class="active">cURL</span><span>JavaScript</span><span>Python</span></div><pre class="code">curl https://fourn-dev-core.onrender.com/v1/chat \
  -H "Authorization: Bearer 4ndev_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"input":"Hello from my application"}'</pre></div></div>';
}

function models() {
  const items = [
    ["✦","Chat","gpt-5.6-luna / 4n-dev-demo-chat","General conversational AI, assistants and product experiences.","/v1/chat","1 credit"],
    ["⌘","Coding","gpt-5.6-luna / 4n-dev-demo-coding","Code generation, debugging and developer assistance.","/v1/coding","5 credits"],
    ["◉","Image","gpt-image-2 / 4n-dev-demo-image","Generate images from natural-language prompts.","/v1/image","10–50 credits"],
    ["◈","Embeddings","text-embedding-3-small / 4n-dev-demo-embedding","Create vector representations for search and retrieval.","/v1/embeddings","1 credit"]
  ];
  return title("Models","Explore the AI capabilities available through the 4N DEV API.") +
  '<div class="notice"><b>Model routing:</b> the public API uses stable capability endpoints. Your application authenticates with a 4N DEV API key rather than a provider secret.</div>' +
  '<div class="section"><div class="grid2">'+items.map(item =>
    '<div class="card model-card"><div class="model-top"><div class="model-icon">'+item[0]+'</div><span class="pill ok">AVAILABLE</span></div><h3>'+item[1]+'</h3><div class="model-id">'+item[2]+'</div><p class="muted">'+item[3]+'</p><div><span class="tag">'+item[4]+'</span><span class="tag">'+item[5]+'</span><span class="tag">Bearer auth</span></div><button class="ghost use-model" data-model="'+item[1].toLowerCase()+'">Try in Playground →</button></div>'
  ).join("")+'</div></div>' +
  '<div class="section"><div class="section-head"><h2>API surface</h2></div><div class="card table-wrap"><table class="table"><thead><tr><th>Capability</th><th>Method</th><th>Endpoint</th><th>Authentication</th></tr></thead><tbody>'+
  items.map(item => '<tr><td><b>'+item[1]+'</b></td><td>POST</td><td class="endpoint">'+item[4]+'</td><td><span class="pill ok">Bearer key</span></td></tr>').join("")+
  '</tbody></table></div></div>';
}

function playground() {
  return title("Playground","Test authenticated Core API requests before integrating them into your application.")+
  '<div class="playground-grid"><div class="card stack"><div class="section-head"><div><h2>Request</h2><p class="muted small">Your developer key is attached automatically.</p></div><span class="pill ok">AUTHENTICATED</span></div><label>Capability<select id="playModel"><option value="chat">Chat</option><option value="coding">Coding</option><option value="image">Image</option><option value="embeddings">Embeddings</option></select></label><label>Prompt / input<textarea id="playInput" rows="12" placeholder="Write a prompt, coding task or image description…"></textarea></label><button id="playRun" class="primary full" type="button">Run request →</button><div class="hint">Usage is deducted from your 4N DEV credit balance.</div></div><div class="card response-card"><div class="section-head"><div><h2>Response</h2><p class="muted small">Core API output</p></div><span id="playState" class="pill">READY</span></div><pre id="playOutput" class="output">Your model response will appear here.</pre></div></div>';
}

function apiKeys() {
  const masked = key ? key.slice(0,12)+"••••••••••••"+key.slice(-4) : "—";
  return title("API Keys","Authentication secrets for your 4N DEV applications.")+
  '<div class="card key-card"><div class="section-head"><div><span class="eyebrow">SECRET CREDENTIAL</span><h2>Developer API key</h2><p class="muted small">This browser currently has one connected developer key.</p></div><span class="pill ok">ACTIVE</span></div><div class="key-display">'+esc(masked)+'</div><div class="toolbar"><button id="copyKey" class="ghost" type="button">Copy key</button><button id="forgetKey" class="danger" type="button">Remove from this device</button></div></div>'+
  '<div class="section"><div class="grid2"><div class="card"><h3>Server integration</h3><p class="muted small">Recommended:</p><pre class="code">FOURN_DEV_API_KEY=4ndev_sk_...</pre><p class="muted small">Read the key from your server environment. Never expose it in client-side JavaScript.</p></div><div class="card"><h3>HTTP authentication</h3><pre class="code">Authorization: Bearer 4ndev_sk_...</pre><p class="muted small">Every protected Core API endpoint uses Bearer authentication.</p></div></div></div>';
}

function projects() {
  return title("Projects","Create applications, manage files, build and publish them.",
    '<button class="primary" id="newProjectTop" type="button">+ New project</button>')+
  '<div class="card"><div class="section-head"><div><h2>Your projects</h2><p class="muted small">Projects are isolated by developer API key.</p></div><button id="reloadProjects" class="ghost" type="button">Refresh</button></div><div class="toolbar create-row"><input id="newProjectName" class="field" maxlength="120" placeholder="Project name"><button id="newProject" class="primary" type="button">Create project</button></div><div id="projectList" class="project-list">Loading projects…</div></div><div id="projectWorkspace" class="hidden section"></div>';
}

function builder() {
  return title("Builder","Describe an application and let 4N DEV plan, generate, review, build and deploy it.")+
  '<div class="builder-grid"><div class="card stack"><div class="section-head"><div><span class="eyebrow">AI APPLICATION BUILDER</span><h2>Build brief</h2></div><span class="pill">CODING CREDITS</span></div><label>Project name<input id="projectName" class="field" maxlength="120" placeholder="e.g. My Business App"></label><label>What should we build?<textarea id="builderPrompt" rows="15" maxlength="24000" placeholder="Example: Build a modern business dashboard with Dashboard, Clients, Invoices and Settings. Make it mobile-first, professional and ready to deploy."></textarea></label><div class="toolbar"><button id="planBtn" class="ghost" type="button">01 · Prepare plan</button><button id="buildBtn" class="primary" type="button">02 · Generate + Build + Deploy →</button></div><span id="builderStatus" class="status"></span><div class="hint">Builder includes quality review and automatic repair before the final build.</div></div><div class="card"><div class="section-head"><div><h2>Build output</h2><p class="muted small">Planner, files, build and deployment status.</p></div></div><pre id="planOutput" class="output hidden"></pre><div id="buildOutput" class="output">Your Builder results will appear here.</div></div></div>';
}

function deployments() {
  return title("Deployments","Published applications and deployment history.")+
  '<div class="card"><div class="section-head"><div><h2>Published applications</h2><p class="muted small">Deployments created from your projects.</p></div><button id="refreshDeployments" class="ghost" type="button">Refresh</button></div><div id="deploymentList">Loading deployments…</div></div>';
}

function usage() {
  return title("Usage","Track API activity, credit consumption and service calls.")+
  '<div class="grid4">'+stat("Credits",money(me?.credits),"Current balance","✦")+stat("Plan",(me?.plan||"free").toUpperCase(),"Current plan","◆")+stat("API status","Healthy","Core API","◈")+stat("Billing","Ready","Credit-based platform","₿")+'</div>'+
  '<div class="section"><div class="section-head"><div><h2>Activity</h2><p class="muted small">Recent authenticated requests.</p></div><button id="refreshUsage" class="ghost" type="button">Refresh</button></div><div class="card table-wrap"><div id="usageList">Loading usage…</div></div></div>';
}

function billing() {
  return title("Billing","Plans, credits, orders and payment checkout.")+
  '<div class="grid3">'+stat("Current plan",(me?.plan||"free").toUpperCase(),"Developer plan","◆")+stat("Credits",money(me?.credits),"Remaining balance","✦")+stat("Currency","MGA","Malagasy Ariary","◇")+'</div>'+
  '<div class="section"><div class="section-head"><div><h2>Plans</h2><p class="muted small">Choose the capacity your application needs.</p></div></div><div id="plans" class="plans-grid">Loading plans…</div></div>'+
  '<div class="section"><div class="section-head"><h2>Orders</h2><button id="refreshOrders" class="ghost" type="button">Refresh</button></div><div class="card"><div id="orders">Loading orders…</div></div></div>';
}

function docs() {
  return title("Documentation","Everything a developer needs to integrate the 4N DEV Core API.")+
  '<div class="docs-grid"><div class="card doc-card"><span class="doc-number">01</span><h3>Authentication</h3><p class="muted small">Use the developer secret as a Bearer token.</p><pre class="code">Authorization: Bearer 4ndev_sk_...</pre></div><div class="card doc-card"><span class="doc-number">02</span><h3>Make a request</h3><p class="muted small">Start with Chat, Coding, Image or Embeddings.</p><pre class="code">POST /v1/chat
Content-Type: application/json</pre></div><div class="card doc-card"><span class="doc-number">03</span><h3>Handle usage</h3><p class="muted small">Monitor credits from the Usage page or API.</p><pre class="code">GET /v1/usage</pre></div></div>'+
  '<div class="section"><div class="section-head"><h2>JavaScript / Node.js</h2><button class="ghost copy-snippet" data-snippet="js">Copy example</button></div><pre class="code large-code">const response = await fetch("https://fourn-dev-core.onrender.com/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.FOURN_DEV_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ input: "Hello from my app" })
});

const data = await response.json();</pre></div>'+
  '<div class="section"><div class="section-head"><h2>Python</h2><button class="ghost copy-snippet" data-snippet="py">Copy example</button></div><pre class="code large-code">import os
import requests

response = requests.post(
    "https://fourn-dev-core.onrender.com/v1/chat",
    headers={
        "Authorization": "Bearer " + os.environ["FOURN_DEV_API_KEY"],
        "Content-Type": "application/json",
    },
    json={"input": "Hello from my app"},
)

print(response.json())</pre></div>'+
  '<div class="section"><div class="section-head"><h2>API reference</h2></div><div class="card table-wrap"><table class="table"><thead><tr><th>Resource</th><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead><tbody>'+
  '<tr><td>Chat</td><td>POST</td><td class="endpoint">/v1/chat</td><td>Conversational AI</td></tr>'+
  '<tr><td>Coding</td><td>POST</td><td class="endpoint">/v1/coding</td><td>Code assistance</td></tr>'+
  '<tr><td>Image</td><td>POST</td><td class="endpoint">/v1/image</td><td>Image generation</td></tr>'+
  '<tr><td>Embeddings</td><td>POST</td><td class="endpoint">/v1/embeddings</td><td>Vector embeddings</td></tr>'+
  '<tr><td>Projects</td><td>GET/POST</td><td class="endpoint">/v1/projects</td><td>Application projects</td></tr>'+
  '<tr><td>Files</td><td>GET/POST/PUT/DELETE</td><td class="endpoint">/v1/projects/:id/files</td><td>Project files</td></tr>'+
  '<tr><td>Builder</td><td>POST</td><td class="endpoint">/v1/builder</td><td>Generate + build + deploy</td></tr>'+
  '<tr><td>Builds</td><td>POST/GET</td><td class="endpoint">/v1/builds</td><td>Build projects</td></tr>'+
  '<tr><td>Deployments</td><td>POST/GET</td><td class="endpoint">/v1/hosting/deployments</td><td>Publish projects</td></tr>'+
  '<tr><td>Usage</td><td>GET</td><td class="endpoint">/v1/usage</td><td>Usage history</td></tr>'+
  '</tbody></table></div></div>';
}

function settings() {
  return title("Settings","Developer account and local console security.")+
  '<div class="grid2"><div class="card"><div class="section-head"><h2>Developer account</h2><span class="pill ok">ACTIVE</span></div>'+
  '<div class="settings-row"><span>Name</span><b>'+esc(me?.name || "—")+'</b></div>'+
  '<div class="settings-row"><span>Account ID</span><b class="mono">'+esc(me?.id || "—")+'</b></div>'+
  '<div class="settings-row"><span>Plan</span><b>'+esc(me?.plan || "—")+'</b></div>'+
  '<div class="settings-row"><span>Credits</span><b>'+esc(me?.credits ?? "—")+'</b></div>'+
  '<div class="settings-row"><span>Scopes</span><b>'+esc((me?.scopes || []).join(", ") || "—")+'</b></div></div>'+
  '<div class="card"><div class="section-head"><h2>Security</h2></div><p class="muted small">Your API key is stored in this browser only after you explicitly continue into the Developer Console. Do not use browser storage for production application secrets.</p><div class="security-list"><div>✓ Bearer authentication</div><div>✓ API key never shown by /v1/me</div><div>✓ Protected project isolation</div><div>✓ Input and path validation</div></div><button id="settingsLogout" class="danger" type="button">Disconnect this device</button></div></div>';
}

const pages = {overview,models,playground,apiKeys,projects,builder,deployments,usage,billing,docs,settings};

function show(page) {
  const render = pages[page] || overview;
  $$(".nav").forEach(nav => nav.classList.toggle("active", nav.dataset.page === page));
  $("#main").innerHTML = render();
  $("#sidebar")?.classList.remove("open");
  bind(page);
  window.scrollTo({top:0, behavior:"smooth"});
}

function bind(page) {
  $$("[data-go]").forEach(button => button.addEventListener("click", () => show(button.dataset.go)));

  if (page === "models") {
    $$(".use-model").forEach(button => button.addEventListener("click", () => {
      show("playground");
      setTimeout(() => { if ($("#playModel")) $("#playModel").value = button.dataset.model; }, 50);
    }));
  }
  if (page === "playground") $("#playRun")?.addEventListener("click", runPlayground);
  if (page === "apiKeys") {
    $("#copyKey")?.addEventListener("click", async () => toast(await copyText(key) ? "API key copied." : "Copy failed.", "success"));
    $("#forgetKey")?.addEventListener("click", logoutDeveloper);
  }
  if (page === "projects") {
    $("#newProject")?.addEventListener("click", createProjectUI);
    $("#reloadProjects")?.addEventListener("click", loadProjects);
    $("#newProjectTop")?.addEventListener("click", () => $("#newProjectName")?.focus());
    loadProjects();
  }
  if (page === "usage") {
    $("#refreshUsage")?.addEventListener("click", loadUsage);
    loadUsage();
  }
  if (page === "builder") {
    $("#planBtn")?.addEventListener("click", planBuilder);
    $("#buildBtn")?.addEventListener("click", buildBuilder);
  }
  if (page === "deployments") {
    $("#refreshDeployments")?.addEventListener("click", loadDeployments);
    loadDeployments();
  }
  if (page === "billing") {
    $("#refreshOrders")?.addEventListener("click", loadOrders);
    loadPlans(); loadOrders();
  }
  if (page === "docs") {
    $$(".copy-snippet").forEach(button => button.addEventListener("click", async () => {
      const text = button.dataset.snippet === "py"
        ? 'import os\nimport requests\n\nresponse = requests.post("https://fourn-dev-core.onrender.com/v1/chat", headers={"Authorization":"Bearer "+os.environ["FOURN_DEV_API_KEY"],"Content-Type":"application/json"}, json={"input":"Hello"})'
        : 'const response = await fetch("https://fourn-dev-core.onrender.com/v1/chat", {method:"POST", headers:{"Authorization":"Bearer "+process.env.FOURN_DEV_API_KEY,"Content-Type":"application/json"}, body:JSON.stringify({input:"Hello"})});';
      toast(await copyText(text) ? "Example copied." : "Copy failed.", "success");
    }));
  }
  if (page === "settings") $("#settingsLogout")?.addEventListener("click", logoutDeveloper);
}

async function runPlayground() {
  const kind = $("#playModel")?.value;
  const input = $("#playInput")?.value.trim();
  if (!input) return toast("Enter a prompt first.", "error");
  $("#playState").textContent = "RUNNING";
  $("#playOutput").textContent = "Waiting for 4N DEV Core…";
  try {
    let data;
    if (kind === "image") data = await api("/v1/image",{method:"POST",body:JSON.stringify({prompt:input,quality:"medium"})});
    else if (kind === "embeddings") data = await api("/v1/embeddings",{method:"POST",body:JSON.stringify({input})});
    else data = await api("/v1/"+kind,{method:"POST",body:JSON.stringify({input})});
    $("#playOutput").textContent = data.output || data.text || data.response || JSON.stringify(data,null,2);
    $("#playState").textContent = "COMPLETED";
    await refreshMe();
    toast("Request completed.", "success");
  } catch (error) {
    $("#playOutput").textContent = "Error: " + error.message;
    $("#playState").textContent = "ERROR";
    toast(error.message, "error");
  }
}

async function planBuilder() {
  const prompt = $("#builderPrompt")?.value.trim();
  if (!prompt) return toast("Describe the application you want to build.", "error");
  const button = $("#planBtn");
  button.disabled = true;
  $("#builderStatus").textContent = "Preparing the application plan…";
  try {
    const data = await api("/v1/builder/plan",{method:"POST",body:JSON.stringify({prompt})});
    lastBuilderPlan = data.plan || null;
    $("#planOutput").classList.remove("hidden");
    $("#planOutput").textContent = JSON.stringify(data.plan,null,2);
    await refreshMe();
    toast("Builder plan ready.", "success");
  } catch (error) {
    $("#planOutput").classList.remove("hidden");
    $("#planOutput").textContent = "Error: " + error.message;
    toast(error.message,"error");
  } finally {
    button.disabled = false;
    $("#builderStatus").textContent = "";
  }
}

async function buildBuilder() {
  const prompt = $("#builderPrompt")?.value.trim();
  if (!prompt) return toast("Describe the application first.", "error");
  const button = $("#buildBtn");
  button.disabled = true;
  $("#builderStatus").textContent = "Generating → reviewing → building → deploying…";
  try {
    const data = await api("/v1/builder",{method:"POST",body:JSON.stringify({
      prompt,
      projectName:$("#projectName")?.value.trim() || "",
      plan:lastBuilderPlan
    }});
    lastBuild = data;
    const deploymentUrl = data.deployment?.url
      ? (data.deployment.url.startsWith("http") ? data.deployment.url : API + data.deployment.url)
      : "";
    $("#buildOutput").innerHTML =
      '<div class="result-summary"><div class="result-icon">✓</div><div><h3>Application built successfully</h3><p>'+esc(data.summary || "Builder completed the project.")+'</p></div></div>'+
      '<div class="result-grid">'+
      '<div><span>Project</span><b>'+esc(data.project?.name || "—")+'</b></div>'+
      '<div><span>Files</span><b>'+esc(data.files?.length || 0)+'</b></div>'+
      '<div><span>Build</span><b>'+esc(data.build?.status || "—")+'</b></div>'+
      '<div><span>Review</span><b>'+esc(data.review?.passed ? "Passed" : "Failed")+'</b></div>'+
      '</div>'+
      (deploymentUrl ? '<a class="primary inline-button" target="_blank" rel="noopener" href="'+esc(deploymentUrl)+'">Open deployed site ↗</a>' : "");
    await refreshMe();
    toast("Builder deployment completed.", "success");
  } catch (error) {
    $("#buildOutput").textContent = "Error: " + error.message;
    toast(error.message,"error");
  } finally {
    button.disabled = false;
    $("#builderStatus").textContent = "";
  }
}

async function loadProjects() {
  try {
    const data = await api("/v1/projects");
    const list = data.projects || [];
    $("#projectList").innerHTML = list.length ? list.map(project =>
      '<div class="project-row"><div class="project-main"><div class="project-symbol">□</div><div><strong>'+esc(project.name)+'</strong><p>'+esc(project.description || "No description")+'</p><span class="mono">'+esc(project.id)+'</span></div></div><div class="toolbar"><button class="ghost open-project" data-id="'+esc(project.id)+'" type="button">Open</button><button class="danger delete-project" data-id="'+esc(project.id)+'" type="button">Delete</button></div></div>'
    ).join("") : '<div class="empty">No projects yet. Create your first application above.</div>';
    $$(".open-project").forEach(button => button.addEventListener("click", () => openProject(button.dataset.id)));
    $$(".delete-project").forEach(button => button.addEventListener("click", () => deleteProject(button.dataset.id)));
  } catch (error) {
    $("#projectList").textContent = "Error: " + error.message;
  }
}

async function createProjectUI() {
  const name = $("#newProjectName")?.value.trim();
  if (!name) return toast("Enter a project name.", "error");
  try {
    await api("/v1/projects",{method:"POST",body:JSON.stringify({name})});
    $("#newProjectName").value = "";
    await loadProjects();
    toast("Project created.", "success");
  } catch (error) { toast(error.message,"error"); }
}

async function deleteProject(id) {
  if (!confirm("Delete this project? This action cannot be undone.")) return;
  try {
    await api("/v1/projects/"+encodeURIComponent(id),{method:"DELETE"});
    $("#projectWorkspace")?.classList.add("hidden");
    await loadProjects();
    toast("Project deleted.","success");
  } catch (error) { toast(error.message,"error"); }
}

async function openProject(id) {
  try {
    const project = await api("/v1/projects/"+encodeURIComponent(id));
    const files = await api("/v1/projects/"+encodeURIComponent(id)+"/files");
    currentProject = project.project;
    currentFiles = files.files || [];
    renderProjectWorkspace();
  } catch (error) { toast(error.message,"error"); }
}

function renderProjectWorkspace() {
  const target = $("#projectWorkspace");
  if (!target || !currentProject) return;
  target.classList.remove("hidden");
  target.innerHTML =
    '<div class="card"><div class="section-head"><div><span class="eyebrow">PROJECT WORKSPACE</span><h2>'+esc(currentProject.name)+'</h2><p class="muted small">'+esc(currentProject.description || "")+'</p></div><div class="toolbar"><button id="buildProject" class="ghost" type="button">Build</button><button id="deployProject" class="primary" type="button">Deploy</button></div></div>'+
    '<div class="workspace-grid"><div><div class="section-head"><h3>Files</h3><span class="pill">'+currentFiles.length+' files</span></div><div id="fileList">'+
    (currentFiles.length ? currentFiles.map(file => '<div class="file-row"><button class="file-open" data-id="'+esc(file.id)+'" type="button">'+esc(file.path)+'</button><span>'+money(file.content?.length || 0)+' chars</span></div>').join("") : '<div class="empty">No files yet.</div>')+
    '</div></div><div><div class="section-head"><h3>Editor</h3><span id="fileStatus" class="status"></span></div><input id="filePath" class="field" placeholder="index.html"><textarea id="fileContent" class="file-editor" placeholder="File content…"></textarea><div class="toolbar"><button id="saveFile" class="primary" type="button">Save file</button><button id="newFile" class="ghost" type="button">New file</button></div></div></div><div id="deployOutput" class="workspace-output"></div></div>';
  $$(".file-open").forEach(button => button.addEventListener("click", () => editFile(button.dataset.id)));
  $("#saveFile")?.addEventListener("click", saveFile);
  $("#newFile")?.addEventListener("click", () => { $("#filePath").value=""; $("#fileContent").value=""; delete $("#saveFile").dataset.id; });
  $("#buildProject")?.addEventListener("click", buildProjectUI);
  $("#deployProject")?.addEventListener("click", deployProject);
}

function editFile(id) {
  const file = currentFiles.find(item => item.id === id);
  if (!file) return;
  $("#filePath").value = file.path;
  $("#fileContent").value = file.content;
  $("#saveFile").dataset.id = file.id;
}

async function saveFile() {
  const path = $("#filePath")?.value.trim();
  const content = $("#fileContent")?.value ?? "";
  if (!path) return toast("Enter a file path.", "error");
  try {
    const fileId = $("#saveFile").dataset.id;
    const base = "/v1/projects/"+encodeURIComponent(currentProject.id)+"/files";
    if (fileId) await api(base+"/"+encodeURIComponent(fileId),{method:"PUT",body:JSON.stringify({path,content})});
    else await api(base,{method:"POST",body:JSON.stringify({path,content})});
    await openProject(currentProject.id);
    toast("File saved.","success");
  } catch (error) {
    $("#fileStatus").textContent = "Error: " + error.message;
  }
}

async function buildProjectUI() {
  const output = $("#deployOutput");
  try {
    const data = await api("/v1/builds",{method:"POST",body:JSON.stringify({projectId:currentProject.id})});
    output.innerHTML = '<div class="notice">Build <b>'+esc(data.build.status)+'</b> · '+esc(data.build.fileCount)+' files · entrypoint '+esc(data.build.entrypoint || "index.html")+'</div>';
    toast("Project built.","success");
  } catch (error) { output.textContent = "Error: " + error.message; }
}

async function deployProject() {
  const output = $("#deployOutput");
  try {
    const data = await api("/v1/hosting/deployments",{method:"POST",body:JSON.stringify({projectId:currentProject.id})});
    const raw = data.deployment?.url || "";
    const url = raw.startsWith("http") ? raw : API + raw;
    output.innerHTML = '<div class="notice">Deployment <b>'+esc(data.deployment?.status || "created")+'</b> · <a class="link" target="_blank" rel="noopener" href="'+esc(url)+'">Open published site ↗</a></div>';
    toast("Project deployed.","success");
  } catch (error) { output.textContent = "Error: " + error.message; }
}

async function loadDeployments() {
  try {
    const data = await api("/v1/hosting/deployments");
    const list = data.deployments || [];
    $("#deploymentList").innerHTML = list.length ? list.map(item =>
      '<div class="deployment-row"><div><strong>'+esc(item.projectName || item.projectId)+'</strong><p><span class="pill ok">'+esc(item.status)+'</span> · version '+esc(item.version)+'</p></div><div class="toolbar"><a class="ghost link-button" target="_blank" rel="noopener" href="'+esc(item.url?.startsWith("http") ? item.url : API+item.url)+'">Open ↗</a><button class="danger unpublish" data-id="'+esc(item.id)+'" type="button">Unpublish</button></div></div>'
    ).join("") : '<div class="empty">No deployments yet.</div>';
    $$(".unpublish").forEach(button => button.addEventListener("click", () => deleteDeployment(button.dataset.id)));
  } catch (error) { $("#deploymentList").textContent = "Error: " + error.message; }
}

async function deleteDeployment(id) {
  if (!confirm("Unpublish this deployment?")) return;
  try {
    await api("/v1/hosting/deployments/"+encodeURIComponent(id),{method:"DELETE"});
    await loadDeployments();
    toast("Deployment unpublished.","success");
  } catch (error) { toast(error.message,"error"); }
}

async function loadUsage() {
  try {
    const data = await api("/v1/usage");
    const rows = data.usage || [];
    $("#usageList").innerHTML = rows.length ? rows.map(item =>
      '<div class="activity-row"><div><strong>'+esc(item.endpoint || item.service || "API request")+'</strong><p>'+esc(item.createdAt || item.timestamp || "")+'</p></div><span class="pill">'+esc(item.credits_used ?? 0)+' credits</span></div>'
    ).join("") : '<div class="empty">No usage records yet. Run a request in Playground to create activity.</div>';
  } catch (error) { $("#usageList").textContent = "Error: " + error.message; }
}

async function loadPlans() {
  try {
    const data = await api("/v1/billing/plans");
    const plans = data.plans || [];
    $("#plans").innerHTML = plans.map(plan =>
      '<div class="card plan-card '+(plan.id === "free" ? "featured" : "")+'"><span class="pill">'+esc(plan.id.toUpperCase())+'</span><h3>'+esc(plan.name)+'</h3><div class="price">'+money(plan.prices?.MGA || 0)+' <small>Ar</small></div><p class="muted small">'+money(plan.credits)+' credits</p><ul>'+(plan.features || []).map(feature => '<li>'+esc(feature)+'</li>').join("")+'</ul>'+(plan.id === "free" ? '<span class="plan-current">Current plan</span>' : '<button class="primary buy" data-plan="'+esc(plan.id)+'" type="button">Choose '+esc(plan.name)+' →</button>')+'</div>'
    ).join("");
    $$(".buy").forEach(button => button.addEventListener("click", () => startOrder(button.dataset.plan)));
  } catch (error) { $("#plans").textContent = "Error: " + error.message; }
}

async function loadOrders() {
  try {
    const data = await api("/v1/billing/orders");
    const orders = data.orders || [];
    $("#orders").innerHTML = orders.length ? orders.map(order =>
      '<div class="order-row"><div><strong>'+esc(order.planId || order.plan_id || "Plan")+'</strong><p>'+esc(order.currency)+' '+esc(order.amount)+' · '+esc(order.status)+'</p></div><span class="mono">'+esc(order.id)+'</span></div>'
    ).join("") : '<div class="empty">No orders yet.</div>';
  } catch (error) { $("#orders").textContent = "Error: " + error.message; }
}

async function startOrder(planId) {
  try {
    const created = await api("/v1/billing/orders",{method:"POST",body:JSON.stringify({planId,currency:"MGA"})});
    const checkout = await api("/v1/billing/orders/"+encodeURIComponent(created.order.id)+"/checkout",{method:"POST",body:JSON.stringify({provider:"papi"})});
    if (checkout.checkout?.paymentLink) location.href = checkout.checkout.paymentLink;
    else toast("Order created, but the payment provider did not return a checkout link yet.","info");
    await loadOrders();
  } catch (error) { toast(error.message,"error"); }
}

function init() {
  const form = $("#createKeyForm");
  $("#createKeyBtn")?.addEventListener("click", createDeveloperKey);
  $("#copyCreatedKey")?.addEventListener("click", copyCreatedKey);
  $("#continueConsoleBtn")?.addEventListener("click", continueToConsole);
  $("#logoutBtn")?.addEventListener("click", logoutDeveloper);
  $("#mobileNav")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
  $("#brandHome")?.addEventListener("click", event => { event.preventDefault(); if (key) show("overview"); });
  $("#getStartedBtn")?.addEventListener("click", focusOnboarding);
  $("#heroGetStarted")?.addEventListener("click", focusOnboarding);
  $("#heroDocs")?.addEventListener("click", () => {
    $("#onboardingCard")?.scrollIntoView({behavior:"smooth",block:"center"});
    toast("Create a key first to open the Developer Console.");
  });
  $("#landingBrand")?.addEventListener("click", event => { event.preventDefault(); focusOnboarding(); });
  $("#developerName")?.addEventListener("keydown", event => { if (event.key === "Enter") form?.requestSubmit(); });
  $$(".nav").forEach(nav => nav.addEventListener("click", () => show(nav.dataset.page)));

  if (key) showConsole();
  else showOnboarding();
}

window.addEventListener("error", event => console.error("4N DEV frontend error:", event.error || event.message));
window.addEventListener("unhandledrejection", event => console.error("4N DEV frontend rejection:", event.reason));
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
