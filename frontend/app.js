'use strict';
(function () {
  var app = document.getElementById('app');
  var key = localStorage.getItem('4ndev_api_key') || '';
  var API_BASE = (localStorage.getItem('4ndev_api_base') || 'https://fourn-dev-core.onrender.com').replace(/\\/+$/, '');
  var page = 'dashboard';
  var me = {};
  var providerList = [];
  var planList = [];
  var titles = {
    dashboard:['Dashboard','A live overview of your 4N DEV Core workspace.'],
    services:['AI Services','Explore the AI capabilities exposed by the Core API.'],
    keys:['API Keys','Create and manage credentials for your independent applications.'],
    projects:['Projects','Manage your application workspaces.'],
    builder:['AI Builder','Plan, generate and review application files.'],
    deployments:['Deployments','Review published applications and deployment status.'],
    usage:['Usage','Monitor requests and credit consumption.'],
    credits:['Credits','Review your available prepaid credit balance.'],
    billing:['Billing','Buy credits with a one-time payment and review orders.'],
    plans:['Plans & Pricing','Compare one-time credit allocations and supported currencies.'],
    docs:['Documentation','Connect your applications to the 4N DEV Core API.'],
    settings:['Settings & Security','Review your workspace and credential safety.']
  };
  var nav = [
    ['dashboard','⌂','Dashboard'],['services','✦','AI Services'],['keys','⌁','API Keys'],
    ['projects','□','Projects'],['builder','◇','AI Builder'],['deployments','↗','Deployments'],
    ['usage','◌','Usage'],['credits','✦','Credits'],['billing','◈','Billing'],
    ['plans','◆','Plans & Pricing'],['docs','▤','Documentation'],['settings','⚙','Settings']
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function money(amount,currency) {
    var n=Number(amount);
    if(!Number.isFinite(n)) return '—';
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:currency,maximumFractionDigits:currency==='MGA'?0:2}).format(n); }
    catch(e){ return String(n)+' '+currency; }
  }
  function date(v) { if(!v)return '—'; var d=new Date(v); return isNaN(d.getTime())?esc(v):d.toLocaleString(); }
  function toast(message,bad) {
    var el=document.createElement('div');el.className='toast '+(bad?'error':'ok');el.textContent=message;document.body.appendChild(el);
    setTimeout(function(){el.remove();},3200);
  }
  async function api(path,options) {
    options=options||{};
    var headers={'Content-Type':'application/json'};
    if(key)headers.Authorization='Bearer '+key;
    options.headers=Object.assign(headers,options.headers||{});
    var response=await fetch(API_BASE+path,options);
    var data=await response.json().catch(function(){return {};});
    if(!response.ok)throw new Error(data.error||data.message||('Request failed ('+response.status+')'));
    return data;
  }
  function button(label,action,kind) {
    var attr=titles[action]?'data-page="'+esc(action)+'"':'data-action="'+esc(action)+'"';
    return '<button class="btn '+(kind||'')+'" '+attr+'>'+esc(label)+'</button>';
  }
  function head(actions) {
    return '<div class="page-head"><div><span class="eyebrow">4N DEV CORE / DEVELOPER CONSOLE</span><h1>'+esc(titles[page][0])+'</h1><p class="muted">'+esc(titles[page][1])+'</p></div><div class="page-actions">'+(actions||'')+'</div></div>';
  }
  function shell() {
    app.innerHTML='<header class="topbar"><div class="left"><button class="menu" id="menu" aria-label="Open navigation">☰</button><div class="logo">4N</div><div class="brand"><b>4N DEV</b><small>Core Developer Platform</small></div><div class="context">Developer Console</div></div><div class="right"><span class="pill green" id="apiStatus">● CONNECTED</span><span class="pill" id="planPill">—</span><span class="pill" id="creditPill">— credits</span><button class="btn" id="logout">Disconnect</button></div></header><div class="layout"><aside class="sidebar" id="sidebar"><div class="workspace"><div class="avatar">4N</div><div><b id="developerName">Developer</b><small>Developer workspace</small></div><i class="online-dot"></i></div><div class="nav-title">CORE PLATFORM</div>'+nav.slice(0,6).map(navButton).join('')+'<div class="nav-title">USAGE & BILLING</div>'+nav.slice(6,10).map(navButton).join('')+'<div class="nav-title">RESOURCES</div>'+nav.slice(10).map(navButton).join('')+'<div class="side-bottom">4N DEV Core <b>API v1</b><p>Independent apps · Shared AI engine</p></div></aside><main id="main" tabindex="-1"></main></div>';
    document.getElementById('menu').onclick=function(){document.getElementById('sidebar').classList.toggle('open');};
    document.getElementById('logout').onclick=function(){localStorage.removeItem('4ndev_api_key');location.reload();};
    document.querySelectorAll('.nav').forEach(function(el){el.onclick=function(){go(el.dataset.page);};});
  }
  function navButton(n){return '<button class="nav" data-page="'+n[0]+'"><span>'+n[1]+'</span>'+n[2]+'</button>';}
  function go(next){page=next;var side=document.getElementById('sidebar');if(side)side.classList.remove('open');render();}
  function bindPage() {
    document.querySelectorAll('[data-page]').forEach(function(el){el.onclick=function(){go(el.dataset.page);};});
    document.querySelectorAll('[data-action]').forEach(function(el){el.onclick=function(){handleAction(el.dataset.action,el);};});
    document.querySelectorAll('[data-copy]').forEach(function(el){el.onclick=function(){copyText(el.dataset.copy);};});
    document.querySelectorAll('[data-toggle]').forEach(function(el){el.onclick=function(){toggleKey(el.dataset.toggle,el.dataset.active==='true');};});
  }
  async function copyText(value) {
    try {
      if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(value);
      else { var input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();var ok=document.execCommand('copy');input.remove();if(!ok)throw new Error('Copy not supported'); }
      toast('Copied to clipboard.');
    } catch(e) { toast('Copy failed. Select and copy the key manually.',true); }
  }
  function dashboard() {
    var features=[
      ['Chat','Conversational AI','/v1/chat','1 credit / request'],
      ['Coding','Code generation','/v1/coding','Credit policy applies'],
      ['Image','AI image generation','/v1/image','Quality-based credit cost'],
      ['Embeddings','Vector representations','/v1/embeddings','Credit policy applies']
    ];
    return head(button('View API keys','keys','')+button('Explore services','services','primary'))+
      '<section class="card hero"><span class="eyebrow">CENTRALIZED AI API ENGINE</span><h2>One Core. Independent applications.</h2><p class="muted">4N DEV Core powers your separate applications through secure <code>4ndev_sk</code> API keys. Apps keep their own interfaces and business logic; Core provides shared AI services, usage and credits.</p><div class="hero-actions">'+button('Manage API keys','keys','primary')+button('Read integration guide','docs','')+'</div></section>'+
      '<section class="grid grid4 section"><div class="card stat"><label>Current plan</label><strong>'+esc(String(me.plan||'free').toUpperCase())+'</strong><small>Attached to this API key</small><span class="glyph">◆</span></div><div class="card stat"><label>Available credits</label><strong>'+esc(me.credits==null?'—':me.credits)+'</strong><small>Prepaid balance</small><span class="glyph">✦</span></div><div class="card stat"><label>API connection</label><strong class="green-text">CONNECTED</strong><small>Authenticated workspace</small><span class="glyph">●</span></div><div class="card stat"><label>Available services</label><strong>04</strong><small>Chat, Coding, Image, Embeddings</small><span class="glyph">⌁</span></div></section>'+
      '<section class="grid grid2 section"><div class="card"><div class="card-head"><div><h3>Core services</h3><p class="muted">Available API endpoints</p></div><span class="pill green">API v1</span></div>'+features.map(function(f){return '<div class="activity"><div><b>'+f[0]+'</b><small>'+f[1]+'</small></div><div class="activity-right"><code>'+f[2]+'</code><small>'+f[3]+'</small></div></div>';}).join('')+'</div><div class="card"><h3>Recent activity</h3><p class="muted">Latest requests recorded for this API key.</p><div id="recentActivity" class="activity-list"><div class="loading">Loading usage…</div></div><div class="section">'+button('View all usage','usage','')+'</div></div></section>'+
      '<div class="notice">Production readiness: the Core console is separate from customer apps. Server migration, production HTTPS, and live payment verification must be completed before public production use.</div>';
  }
  function services() {
    var list=[
      {name:'4N-Chat',route:'/v1/chat',model:'Luna',desc:'Conversational AI for chat experiences.',cost:'1 credit per request'},
      {name:'4N-Code',route:'/v1/coding',model:'Sol',desc:'Code generation and developer assistance.',cost:'See current credit policy'},
      {name:'4N-Image',route:'/v1/image',model:'OpenAI Image',desc:'Generate images through the configured image provider.',cost:'Depends on image quality'},
      {name:'Embeddings',route:'/v1/embeddings',model:'Configured provider',desc:'Convert text into vector representations.',cost:'See current credit policy'}
    ];
    return head(button('View credit policy','credits',''))+'<div class="grid grid2">'+list.map(function(s){return '<article class="card service"><div class="service-top"><div class="icon">✦</div><span class="pill green">CORE API</span></div><h3>'+s.name+'</h3><p>'+s.desc+'</p><div class="service-meta"><span>Configured model</span><b>'+s.model+'</b></div><code class="mono">'+s.route+'</code><div class="service-foot">'+s.cost+'</div><button class="btn" data-copy="'+s.route+'">Copy endpoint</button></article>';}).join('')+'</div><div class="notice">Model labels above reflect the intended product mapping. Confirm the deployed provider configuration before treating a model name as a guaranteed runtime model.</div>';
  }
  async function keysPage() {
    var d=await api('/v1/keys');var arr=d.keys||[];
    return head(button('Create API key','create-key','primary'))+'<div class="card"><div class="card-head"><div><h3>API credentials</h3><p class="muted">Secret keys are shown only at creation. Keep them on your server, never in public client-side code.</p></div><span class="pill">'+arr.length+' active</span></div>'+
      (arr.length?arr.map(function(k){return '<div class="key"><div class="key-info"><b>'+esc(k.name||'Developer key')+'</b><small class="mono">'+esc(k.prefix||'4ndev_sk_••••••••')+'…</small><div class="key-tags"><span class="pill">'+esc(k.planId||'free')+'</span><span class="pill green">Active</span><span class="muted">Created '+esc(date(k.createdAt))+'</span></div></div><button class="btn danger" data-toggle="'+esc(k.id)+'" data-active="true">Revoke key</button></div>';}).join(''):'<div class="empty"><div class="big">⌁</div><p>No active API key is listed for this workspace.</p></div>')+
      '<div class="notice">For safety, this endpoint currently lists the credential used to sign in. Key creation creates a new credential; save its secret when shown. Revoking the connected key disconnects this console.</div></div>'+
      '<div class="card section"><h3>Use your key from a server</h3><p class="muted">Send the key in the Authorization header. Do not put production secrets in frontend JavaScript.</p><pre class="code-sample">Authorization: Bearer 4ndev_sk_…</pre>'+button('Copy header example','copy-auth','')+'</div>';
  }
  function table(headers,rows) {
    if(!rows||!rows.length)return '<div class="empty"><p>No records yet.</p></div>';
    return '<div class="table-wrap"><table><thead><tr>'+headers.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  }
  async function usagePage() {
    var d=await api('/v1/usage?limit=100');var rows=d.usage||[];
    var total=rows.reduce(function(sum,r){return sum+Number((r.usage||{}).credits_used||r.credits_used||0);},0);
    return head(button('Refresh','refresh',''))+'<div class="grid grid3"><div class="card stat"><label>Recorded requests</label><strong>'+rows.length+'</strong><small>Loaded activity records</small></div><div class="card stat"><label>Credits used in records</label><strong>'+total+'</strong><small>Sum of returned usage data</small></div><div class="card stat"><label>Current balance</label><strong>'+esc(me.credits==null?'—':me.credits)+'</strong><small>Available credits</small></div></div><div class="card section"><div class="card-head"><div><h3>Request history</h3><p class="muted">Most recent usage records for this key.</p></div><span class="pill">'+(d.pagination?d.pagination.total:rows.length)+' records</span></div>'+table(['Endpoint','Model','Credits used','Date'],rows.map(function(r){var u=r.usage||{};return '<tr><td><code>'+esc(r.endpoint||r.path||'—')+'</code></td><td>'+esc(u.model||r.model||'—')+'</td><td>'+esc(u.credits_used==null?'—':u.credits_used)+'</td><td>'+esc(date(r.createdAt||r.created_at||r.timestamp))+'</td></tr>';}))+'</div>';
  }
  async function creditsPage() {
    var results=await Promise.all([api('/v1/credits'),api('/v1/credit-policy')]);
    var balance=results[0].credits;var policy=results[1].policy||{};
    return head(button('Buy credits','billing','primary'))+'<div class="grid grid2"><div class="card balance-card"><span class="eyebrow">AVAILABLE BALANCE</span><strong>'+esc(balance==null?'—':balance)+'</strong><p class="muted">credits available for this API key</p>'+button('Purchase more credits','billing','primary')+'</div><div class="card"><h3>Credit usage policy</h3><p class="muted">Costs returned by the Core API configuration.</p><div id="policyItems">'+Object.keys(policy).map(function(k){var v=policy[k];return '<div class="activity"><b>'+esc(k)+'</b><code>'+esc(typeof v==='object'?JSON.stringify(v):v)+'</code></div>';}).join('')+'</div></div></div>';
  }
  async function plansData() {
    var d=await api('/v1/billing/plans');planList=d.plans||[];return d;
  }
  function planCard(p,currency) {
    var price=p.prices&&p.prices[currency];
    return '<article class="card plan-card '+(p.id==='pro'?'featured':'')+'"><span class="pill">'+esc(p.name||p.id)+'</span><h3>'+esc(p.name||p.id)+'</h3><div class="price">'+money(price,currency)+'</div><p class="muted">'+esc(p.credits||0)+' credits per purchase</p><ul><li>One-time purchase</li><li>'+((p.features||[]).map(esc).join(', ')||'Basic access')+'</li><li>No automatic renewal</li></ul>'+(p.id==='free'?'<button class="btn" disabled>Current free tier</button>':'<button class="btn '+(p.id==='pro'?'primary':'')+'" data-action="buy-plan" data-plan="'+esc(p.id)+'" data-currency="'+esc(currency)+'">Choose package</button>')+'</article>';
  }
  async function billingPage() {
    var results=await Promise.all([api('/v1/billing/plans'),api('/v1/billing/providers'),api('/v1/billing/orders')]);
    planList=results[0].plans||[];providerList=(results[1].providers||[]).filter(function(p){return p.configured===true;});
    var orders=results[2].orders||[];
    var currency=localStorage.getItem('4ndev_currency')||'USD';
    return head('<label class="currency-label" for="currencySelect">Currency</label><select class="field currency-select" id="currencySelect"><option value="USD" '+(currency==='USD'?'selected':'')+'>USD · US Dollar</option><option value="EUR" '+(currency==='EUR'?'selected':'')+'>EUR · Euro</option><option value="MGA" '+(currency==='MGA'?'selected':'')+'>MGA · Ariary</option></select>')+
      '<div class="billing-intro card"><div><span class="eyebrow">PREPAID BILLING</span><h2>Buy credits when you need them.</h2><p class="muted">One-time checkout. No automatic subscription renewal. Credits are added after the payment provider confirms a successful payment.</p></div><div class="billing-balance"><small>Current balance</small><strong>'+esc(me.credits==null?'—':me.credits)+'</strong><span>credits</span></div></div>'+
      '<div class="section"><div class="section-title"><h2>Credit packages</h2><p class="muted">Select a package and currency.</p></div><div class="plans" id="planCards">'+planList.map(function(p){return planCard(p,currency);}).join('')+'</div></div>'+
      '<div class="card section"><div class="card-head"><div><h3>Order history</h3><p class="muted">Orders and payment status for this API key.</p></div><button class="btn" data-action="refresh">Refresh</button></div>'+table(['Order','Package','Amount','Status','Created'],orders.map(function(o){return '<tr><td><code>'+esc(String(o.id||'').slice(0,8))+'</code></td><td>'+esc(o.planId||'—')+'</td><td>'+money(o.amount,o.currency||'USD')+'</td><td><span class="status '+esc(o.status||'pending')+'">'+esc(o.status||'pending')+'</span></td><td>'+esc(date(o.createdAt))+'</td></tr>';}))+'</div>'+
      '<div class="notice">Payment methods shown by the Core API depend on provider configuration. Never consider an order paid based only on a browser redirect; the verified provider webhook must confirm it.</div>';
  }
  async function plansPage() {
    var d=await api('/v1/billing/plans');var currency=localStorage.getItem('4ndev_currency')||'USD';
    return head(button('Go to Billing','billing','primary'))+'<div class="plans">'+(d.plans||[]).map(function(p){return planCard(p,currency);}).join('')+'</div><div class="notice">Prices are taken from the current Core API plan configuration. These packages are not recurring subscriptions in the checkout flow.</div>';
  }
  async function projectsPage() {
    var d=await api('/v1/projects');var arr=d.projects||[];
    return head(button('Create project','new-project','primary'))+'<div class="card"><div class="card-head"><div><h3>Your projects</h3><p class="muted">Projects remain separate from the Core API engine.</p></div><span class="pill">'+arr.length+' projects</span></div>'+(arr.length?arr.map(function(p){return '<div class="key"><div><b>'+esc(p.name||'Untitled project')+'</b><small>'+esc(p.description||'No description')+'</small><small class="muted">'+esc(p.id||'')+' · '+esc(date(p.updatedAt||p.createdAt))+'</small></div><span class="status">'+esc(p.status||'saved')+'</span></div>';}).join(''):'<div class="empty"><div class="big">□</div><p>No projects yet. Create a project to start organizing application files.</p></div>')+'</div>';
  }
  async function deploymentsPage() {
    var d=await api('/v1/hosting/deployments');var arr=d.deployments||[];
    return head(button('Refresh','refresh',''))+'<div class="card"><div class="card-head"><div><h3>Published applications</h3><p class="muted">Hosting and deployments currently recorded by Core.</p></div><span class="pill">'+arr.length+' deployments</span></div>'+(arr.length?arr.map(function(x){var url=x.url||('/sites/'+(x.slug||''));return '<div class="key"><div><b>'+esc(x.projectName||x.slug||'Deployment')+'</b><small><code>'+esc(url)+'</code></small><small>'+esc(x.status||'unknown')+' · v'+esc(x.version||1)+' · '+esc(date(x.updatedAt||x.createdAt))+'</small></div><div class="key-actions"><button class="btn" data-copy="'+esc(location.origin+url)+'">Copy URL</button><a class="btn" href="'+esc(url)+'" target="_blank" rel="noopener">Open</a></div></div>';}).join(''):'<div class="empty"><div class="big">↗</div><p>No deployments are listed. Create a project, add an index.html file, then deploy it through the hosting API.</p></div>')+'</div>';
  }
  async function genericRaw(label,path) {
    var d=await api(path);
    return head(button('Refresh','refresh',''))+'<div class="card"><div class="card-head"><div><h3>'+esc(label)+'</h3><p class="muted">Data returned by the Core API.</p></div><span class="pill green">Connected</span></div><pre class="code-sample">'+esc(JSON.stringify(d,null,2))+'</pre></div>';
  }
  function builderPage() {
    return head()+'<div class="grid grid2"><div class="card"><span class="eyebrow">AI PLANNER</span><h3>Plan an application</h3><p class="muted">Describe the app you want to build. The planner returns a structured plan using your available Core credits.</p><label class="field-label" for="builderPrompt">Application description</label><textarea id="builderPrompt" class="field" rows="7" maxlength="12000" placeholder="Create a responsive shop website with product cards, cart and contact page…"></textarea><div class="form-foot"><span class="muted tiny">Planner cost is defined by the Core credit policy.</span><button class="btn primary" id="runPlanner">Generate plan</button></div></div><div class="card"><h3>Planner output</h3><p class="muted">Your generated plan will appear here.</p><div id="plannerResult" class="planner-result"><div class="empty compact"><p>Enter a description and run the planner to begin.</p></div></div></div></div>';
  }
  function docsPage() {
    var base=location.origin;
    return head()+'<div class="grid grid2"><div class="card"><div class="icon">⌁</div><h3>1. Authentication</h3><p class="muted">Keep the secret in your backend environment and send it with each request.</p><pre class="code-sample">Authorization: Bearer 4ndev_sk_…</pre>'+button('Copy header','copy-auth','')+'</div><div class="card"><div class="icon">⌘</div><h3>2. API base URL</h3><pre class="code-sample">'+esc(base)+'/v1/</pre>'+button('Copy API base URL','copy-base','')+'</div><div class="card"><h3>Available endpoints</h3>'+[['Chat','POST /v1/chat'],['Coding','POST /v1/coding'],['Image','POST /v1/image'],['Embeddings','POST /v1/embeddings'],['Credits','GET /v1/credits'],['Usage','GET /v1/usage'],['Projects','/v1/projects'],['Builder','/v1/builder'],['Deployments','/v1/hosting/deployments']].map(function(x){return '<div class="activity"><b>'+x[0]+'</b><code>'+x[1]+'</code></div>';}).join('')+'</div><div class="card"><h3>Security checklist</h3><ul class="check-list"><li>Never embed production keys in browser JavaScript.</li><li>Use HTTPS in production.</li><li>Rotate a key immediately if it is exposed.</li><li>Keep usage and credit limits in your own backend.</li></ul></div></div>';
  }
  function settingsPage() {
    return head()+'<div class="grid grid2"><div class="card"><h3>Workspace identity</h3><div class="setting-row"><span>Developer</span><b>'+esc(me.name||'Developer')+'</b></div><div class="setting-row"><span>Plan</span><b>'+esc(me.plan||'free')+'</b></div><div class="setting-row"><span>Account status</span><b class="green-text">'+(me.active===false?'Inactive':'Active')+'</b></div><div class="setting-row"><span>Created</span><b>'+esc(date(me.createdAt))+'</b></div></div><div class="card"><h3>Security</h3><p class="muted">The current API key is stored in this browser to keep the console connected.</p><div class="notice">For production integrations, store keys in server-side environment variables. Do not share secrets in screenshots, public repositories or client-side bundles.</div><div class="section">'+button('Disconnect this browser','logout','')+button('Manage API keys','keys','')+'</div></div></div>';
  }
  async function render() {
    var main=document.getElementById('main');if(!main)return;
    document.querySelectorAll('.nav').forEach(function(n){n.classList.toggle('active',n.dataset.page===page);});
    main.innerHTML='<div class="loading">Loading '+esc(titles[page][0])+'…</div>';
    try {
      if(page==='dashboard')main.innerHTML=dashboard();
      else if(page==='services')main.innerHTML=services();
      else if(page==='keys')main.innerHTML=await keysPage();
      else if(page==='usage')main.innerHTML=await usagePage();
      else if(page==='credits')main.innerHTML=await creditsPage();
      else if(page==='billing')main.innerHTML=await billingPage();
      else if(page==='plans')main.innerHTML=await plansPage();
      else if(page==='projects')main.innerHTML=await projectsPage();
      else if(page==='deployments')main.innerHTML=await deploymentsPage();
      else if(page==='builder')main.innerHTML=builderPage();
      else if(page==='docs')main.innerHTML=docsPage();
      else if(page==='settings')main.innerHTML=settingsPage();
      bindPage();
      if(page==='builder'){var run=document.getElementById('runPlanner');if(run)run.onclick=runBuilderPlanner;}
      if(page==='dashboard')loadRecentActivity();
      var currencySelect=document.getElementById('currencySelect');
      if(currencySelect)currencySelect.onchange=function(){localStorage.setItem('4ndev_currency',currencySelect.value);render();};
    } catch(error) {
      main.innerHTML=head()+'<div class="card error-panel"><div class="big">!</div><h3>Could not load this section</h3><p>'+esc(error.message)+'</p><p class="muted">Check the connection and try again. The console will not display fabricated account data.</p>'+button('Retry','refresh','primary')+'</div>';
      bindPage();
    }
  }
  async function loadRecentActivity() {
    var el=document.getElementById('recentActivity');if(!el)return;
    try {
      var d=await api('/v1/usage?limit=5');var arr=d.usage||[];
      el.innerHTML=arr.length?arr.slice(0,5).map(function(r){var u=r.usage||{};return '<div class="activity"><div><b>'+esc(r.endpoint||r.path||'API request')+'</b><small>'+esc(date(r.createdAt||r.created_at||r.timestamp))+'</small></div><div class="activity-right"><code>'+esc(u.credits_used==null?'—':u.credits_used)+' credits</code></div></div>';}).join(''):'<div class="empty compact"><p>No usage recorded yet. Your requests will appear here.</p></div>';
    } catch(e) { el.innerHTML='<p class="muted">Usage history is temporarily unavailable.</p>'; }
  }
  async function runBuilderPlanner() {
    var prompt=document.getElementById('builderPrompt').value.trim();var output=document.getElementById('plannerResult');var btn=document.getElementById('runPlanner');
    if(!prompt){toast('Describe the application first.',true);return;}
    btn.disabled=true;btn.textContent='Planning…';output.innerHTML='<div class="loading">Generating plan…</div>';
    try{var result=await api('/v1/builder/plan',{method:'POST',body:JSON.stringify({prompt:prompt})});output.innerHTML='<div class="planner-meta"><span class="pill green">Plan ready</span><span class="muted">'+esc(result.model||'Core planner')+'</span></div><pre class="code-sample">'+esc(JSON.stringify(result.plan||result,null,2))+'</pre><p class="muted tiny">Credits used: '+esc(result.credits_used==null?'—':result.credits_used)+' · Remaining: '+esc(result.credits_remaining==null?'—':result.credits_remaining)+'</p>';await loadMe();}catch(e){output.innerHTML='<div class="notice error-notice">'+esc(e.message)+'</div>';}finally{btn.disabled=false;btn.textContent='Generate plan';}
  }
  async function toggleKey(id,active) {
    var message=active?'Revoking this key will disconnect the current console if it is the key you are using. Continue?':'Activate this key?';
    if(!window.confirm(message))return;
    try {
      await api('/v1/keys/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({active:!active})});
      if(active){localStorage.removeItem('4ndev_api_key');toast('API key revoked.');setTimeout(function(){location.reload();},600);}
      else {toast('Key activated.');render();}
    } catch(e){toast(e.message,true);}
  }
  function showNewKey(secret,name) {
    var modal=document.createElement('div');modal.className='modal';
    modal.innerHTML='<div class="modal-card"><span class="eyebrow">API KEY CREATED</span><h2>Your secret key</h2><p class="muted">Copy and store this key now. For security, the full secret will not be shown again after closing this window.</p><label class="field-label" for="secretKeyValue">4N DEV secret</label><textarea id="secretKeyValue" class="field secret-key" readonly></textarea><div class="modal-actions modal-actions-start"><button class="btn" id="copyNewKey">Copy key</button><button class="btn primary" id="useNewKey">Connect with this key</button></div><button class="text-button" id="closeNewKey">Keep current session</button><p class="notice">New credential: '+esc(name)+'. Keep it private; never paste it into public frontend code.</p></div>';
    document.body.appendChild(modal);document.getElementById('secretKeyValue').value=secret;
    document.getElementById('copyNewKey').onclick=function(){copyText(secret);};
    document.getElementById('useNewKey').onclick=function(){localStorage.setItem('4ndev_api_key',secret);location.reload();};
    document.getElementById('closeNewKey').onclick=function(){modal.remove();};
  }
  async function createKey() {
    var modal=document.createElement('div');modal.className='modal';
    modal.innerHTML='<div class="modal-card"><h2>Create API key</h2><p class="muted">Name the credential so you can identify its intended application.</p><label class="field-label" for="newKeyName">Key name</label><input id="newKeyName" class="field" maxlength="80" placeholder="e.g. N-AI Chat production"><div class="modal-actions"><button class="btn" id="cancelNewKey">Cancel</button><button class="btn primary" id="submitNewKey">Create key</button></div></div>';
    document.body.appendChild(modal);document.getElementById('cancelNewKey').onclick=function(){modal.remove();};
    document.getElementById('submitNewKey').onclick=async function(){
      var name=document.getElementById('newKeyName').value.trim();if(!name){toast('Enter a key name.',true);return;}
      var btn=document.getElementById('submitNewKey');btn.disabled=true;btn.textContent='Creating…';
      try{var d=await api('/v1/keys/create',{method:'POST',body:JSON.stringify({name:name})});modal.remove();showNewKey(d.api_key,name);}
      catch(e){btn.disabled=false;btn.textContent='Create key';toast(e.message,true);}
    };
  }
  async function buyPlan(planId,currency) {
    var providerResponse=await api('/v1/billing/providers');
    var available=(providerResponse.providers||[]).filter(function(x){return x.configured===true&&(x.currencies||[]).indexOf(currency)>=0;});
    if(!available.length)throw new Error('No configured payment provider supports '+currency+' yet. No order was created.');
    var p=planList.find(function(x){return x.id===planId;});
    if(!p){var d=await api('/v1/billing/plans');p=(d.plans||[]).find(function(x){return x.id===planId;});}
    if(!p)throw new Error('Package not found.');
    var amount=p.prices&&p.prices[currency];
    if(amount==null)throw new Error('No price configured for '+currency+'.');
    if(!window.confirm('Create a one-time order for '+p.name+' · '+money(amount,currency)+'?'))return;
    var orderResult=await api('/v1/billing/orders',{method:'POST',body:JSON.stringify({planId:planId,currency:currency})});
    showCheckout(orderResult.order,available);
  }
  function showCheckout(order,providers) {
    var modal=document.createElement('div');modal.className='modal';
    modal.innerHTML='<div class="modal-card"><h2>Complete payment</h2><p class="muted">Order <code>'+esc(String(order.id).slice(0,12))+'</code> · '+money(order.amount,order.currency)+'</p><label class="field-label" for="providerSelect">Payment method</label><select id="providerSelect" class="field">'+providers.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name||p.id)+(p.configured?' · configured':'')+'</option>';}).join('')+'</select><div class="modal-actions"><button class="btn" id="cancelCheckout">Later</button><button class="btn primary" id="startCheckout">Continue to payment</button></div><p class="muted tiny">Credits are only granted after the provider webhook verifies payment.</p></div>';
    document.body.appendChild(modal);document.getElementById('cancelCheckout').onclick=function(){modal.remove();render();};
    document.getElementById('startCheckout').onclick=async function(){
      var btn=this;btn.disabled=true;btn.textContent='Preparing…';
      try{
        var result=await api('/v1/billing/orders/'+encodeURIComponent(order.id)+'/checkout',{method:'POST',body:JSON.stringify({provider:document.getElementById('providerSelect').value})});
        var checkout=result.checkout||{};var url=checkout.paymentLink||checkout.shortLink||result.payment&&result.payment.checkoutUrl;
        modal.remove();
        if(url){window.location.href=url;}
        else {toast('Checkout created but no payment URL was returned.',true);render();}
      }catch(e){btn.disabled=false;btn.textContent='Continue to payment';toast(e.message,true);}
    };
  }
  async function handleAction(action,el) {
    try {
      if(action==='refresh'){await loadMe();await render();return;}
      if(action==='create-key'){createKey();return;}
      if(action==='buy-plan'){await buyPlan(el.dataset.plan,el.dataset.currency);return;}
      if(action==='new-project'){newProject();return;}
      if(action==='copy-auth'){await copyText('Authorization: Bearer 4ndev_sk_…');return;}
      if(action==='copy-base'){await copyText(location.origin+'/v1/');return;}
      if(action==='logout'){localStorage.removeItem('4ndev_api_key');location.reload();return;}
    } catch(e){toast(e.message,true);}
  }
  function newProject() {
    var modal=document.createElement('div');modal.className='modal';
    modal.innerHTML='<div class="modal-card"><h2>Create project</h2><label class="field-label" for="projectName">Project name</label><input id="projectName" class="field" maxlength="120" placeholder="My application"><label class="field-label" for="projectDescription">Description</label><textarea id="projectDescription" class="field" rows="3" maxlength="2000" placeholder="What are you building?"></textarea><div class="modal-actions"><button class="btn" id="cancelProject">Cancel</button><button class="btn primary" id="saveProject">Create project</button></div></div>';
    document.body.appendChild(modal);document.getElementById('cancelProject').onclick=function(){modal.remove();};
    document.getElementById('saveProject').onclick=async function(){var name=document.getElementById('projectName').value.trim();if(!name){toast('Project name is required.',true);return;}var btn=this;btn.disabled=true;try{await api('/v1/projects',{method:'POST',body:JSON.stringify({name:name,description:document.getElementById('projectDescription').value.trim()})});modal.remove();toast('Project created.');render();}catch(e){btn.disabled=false;toast(e.message,true);}};
  }
  async function loadMe() {var d=await api('/v1/me');me=d.developer||{};var nameEl=document.getElementById('developerName');var planEl=document.getElementById('planPill');var creditEl=document.getElementById('creditPill');if(nameEl)nameEl.textContent=me.name||'Developer';if(planEl)planEl.textContent=String(me.plan||'free').toUpperCase();if(creditEl)creditEl.textContent=String(me.credits==null?'—':me.credits)+' credits';}
  function login() {
    app.innerHTML='<div class="login-screen"><div class="login-card"><div class="logo">4N</div><span class="eyebrow">4N DEV CORE</span><h1>Developer Console</h1><p class="muted">Connect an existing <code>4ndev_sk</code> key to manage your Core workspace.</p><label class="field-label" for="loginKey">Secret API key</label><input id="loginKey" class="field" placeholder="4ndev_sk_…" autocomplete="off" autocapitalize="off" spellcheck="false"><p class="muted tiny">Your key is sent only as a Bearer token to the Core API.</p><button class="btn primary full" id="loginBtn">Connect to Core</button><p class="login-help">Don't have a key? Use the API key onboarding flow provided by your Core administrator.</p><div id="loginError" class="login-error" hidden></div></div></div>';
    var field=document.getElementById('loginKey');field.value=key;
    async function connect(){var value=field.value.trim();if(!value){document.getElementById('loginError').hidden=false;document.getElementById('loginError').textContent='Enter your API key.';return;}var btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='Connecting…';key=value;try{await api('/v1/me');localStorage.setItem('4ndev_api_key',value);await load();}catch(e){key='';document.getElementById('loginError').hidden=false;document.getElementById('loginError').textContent='Could not authenticate: '+e.message;btn.disabled=false;btn.textContent='Connect to Core';}}
    document.getElementById('loginBtn').onclick=connect;field.addEventListener('keydown',function(e){if(e.key==='Enter')connect();});
  }
  async function load() {
    if(!key){login();return;}
    try {await loadMe();shell();await render();}
    catch(e){localStorage.removeItem('4ndev_api_key');key='';login();}
  }
  load();
})();