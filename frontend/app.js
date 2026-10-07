"use strict";
(() => {
  const S = { key: localStorage.getItem("4ndev_api_key") || "", page: "dashboard" };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  const pages = {
    dashboard: ["Dashboard","Your 4N DEV workspace at a glance.","Connect, build, deploy and operate from one professional console."],
    playground: ["Playground","Test AI capabilities.","Run prompts and inspect responses in a dedicated workspace."],
    models: ["AI Models","Explore available AI capabilities.","Chat, coding, image generation and embeddings."],
    apiKeys: ["API Keys","Manage developer credentials.","Create, protect and rotate API access keys."],
    projects: ["Projects","Organize applications and files.","Create projects, manage source files and prepare deployments."],
    builder: ["AI Builder","Build applications with AI.","Describe an application, generate a plan and prepare a build."],
    deployments: ["Deployments","Publish and manage applications.","Track deployment state, URLs and release history."],
    usage: ["Usage","Understand API activity.","Monitor requests, credits and consumption over time."],
    credits: ["Credits","Manage your AI capacity.","Review your balance and the credit cost of each capability."],
    billing: ["Billing","Manage payments and account billing.","Orders, payment status and billing history."],
    plans: ["Plans","Choose the right capacity.","Compare plans and continue to checkout when ready."],
    docs: ["Documentation","Learn how to use 4N DEV.","Authentication, quickstarts, projects, Builder and operations."],
    apiReference: ["API Reference","Explore the Core API v1.","Endpoints, methods, authentication and examples."],
    support: ["Support","Get help when you need it.","Documentation, diagnostics and developer support."],
    status: ["System Status","Monitor platform health.","Core API availability and service status."],
    settings: ["Settings & Security","Control your workspace.","Account, security and local credential settings."]
  };

  function openConsole() {
    S.key = localStorage.getItem("4ndev_api_key") || "";
    if (!S.key) return false;
    $("#onboardingScreen")?.classList.add("hidden");
    $("#consoleScreen")?.classList.remove("hidden");
    navigate(S.page);
    return true;
  }

  function showOnboarding() {
    $("#consoleScreen")?.classList.add("hidden");
    $("#onboardingScreen")?.classList.remove("hidden");
  }

  function render(page) {
    const p = pages[page] || pages.dashboard;
    const isDashboard = page === "dashboard";
    $("#main").innerHTML = `
      <header class="page-head">
        <div>
          <span class="eyebrow">4N DEV / DEVELOPER CONSOLE</span>
          <h1>${esc(p[0])}</h1>
          <p class="muted">${esc(p[1])}</p>
        </div>
        <div class="actions">
          <span class="badge green">CORE ONLINE</span>
        </div>
      </header>
      ${isDashboard ? dashboard() : section(page, p[2])}
    `;
  }

  function dashboard() {
    return `
      <section class="hero-grid">
        <article class="card hero">
          <span class="eyebrow">DEVELOPER PLATFORM</span>
          <h2>Build with AI. Ship with 4N DEV.</h2>
          <p class="muted">Your complete workspace for models, APIs, projects, AI Builder, deployments, usage and billing.</p>
          <div class="actions">
            <button class="primary" data-page="playground">Open Playground</button>
            <button class="ghost" data-page="docs">Read Documentation</button>
          </div>
        </article>
        <article class="card">
          <div class="card-head"><b>Workspace</b><span class="badge green">READY</span></div>
          <h3>Developer Console</h3>
          <p class="muted">Secure Bearer authentication · API v1</p>
          <code class="endpoint">/v1</code>
          <div class="live"><i></i> Interface ready</div>
        </article>
      </section>
      <div class="stats">
        <div class="stat"><span>AI Models</span><b>4</b><small>Core capabilities</small><i>✦</i></div>
        <div class="stat"><span>Workspace</span><b>READY</b><small>Developer access</small><i>◇</i></div>
        <div class="stat"><span>API</span><b>v1</b><small>Stable surface</small><i>⌁</i></div>
        <div class="stat"><span>Security</span><b>ON</b><small>Bearer auth</small><i>✓</i></div>
      </div>
      <section class="card section">
        <div class="card-head"><h3>Developer workflow</h3><span class="muted">Start anywhere</span></div>
        <div class="workflow">
          <button data-page="apiKeys"><b>01</b><strong>API Keys</strong><span>Manage secure credentials.</span></button>
          <button data-page="playground"><b>02</b><strong>Playground</strong><span>Test AI requests.</span></button>
          <button data-page="projects"><b>03</b><strong>Projects</strong><span>Organize applications.</span></button>
          <button data-page="deployments"><b>04</b><strong>Deployments</strong><span>Publish and operate.</span></button>
        </div>
      </section>
    `;
  }

  function section(page, description) {
    const actions = {
      playground: ["Open Playground workspace","Run AI requests without leaving the console."],
      models: ["Model catalog","Compare capabilities before integrating them."],
      apiKeys: ["Credential management","Your API key area will be connected to the existing Core API in Step 2."],
      projects: ["Project workspace","Project creation, files and deletion will be connected in Step 2."],
      builder: ["AI Builder workspace","Planner and Builder actions will be connected in Step 2."],
      deployments: ["Deployment center","Deployment loading and actions will be connected in Step 2."],
      usage: ["Usage center","Usage loading and credit analytics will be connected in Step 2."],
      credits: ["Credit center","Credit balance and policy will be connected in Step 2."],
      billing: ["Billing center","Orders and payment status will be connected in Step 2."],
      plans: ["Plan catalog","PAPI checkout will be connected in Step 2."],
      docs: ["Developer documentation","Guides and quickstarts will be expanded in Step 2."],
      apiReference: ["API reference","The complete endpoint reference will be connected in Step 2."],
      support: ["Developer support","Diagnostics and support resources will be connected in Step 2."],
      status: ["System status","Live health checks will be connected in Step 2."],
      settings: ["Settings & security","Account and credential controls will be connected in Step 2."]
    };
    const [title,text] = actions[page] || [pages[page][0],description];
    return `
      <section class="card empty-state">
        <div class="icon">✦</div>
        <span class="eyebrow">STEP 1 · INTERFACE</span>
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(text)}</p>
        <div class="interface-ready"><i></i><b>Interface ready</b><span>Navigation is active. Backend actions are intentionally not called in Step 1.</span></div>
      </section>
    `;
  }

  function navigate(page) {
    S.page = pages[page] ? page : "dashboard";
    $$(".nav").forEach(n => n.classList.toggle("active", n.dataset.page === S.page));
    render(S.page);
    $("#sidebar")?.classList.remove("open");
    window.scrollTo(0,0);
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      navigate(pageButton.dataset.page);
      return;
    }
    if (event.target.closest("#mobileNav")) {
      $("#sidebar")?.classList.toggle("open");
      return;
    }
    if (event.target.closest("#brandHome")) {
      event.preventDefault();
      navigate("dashboard");
      return;
    }
    if (event.target.closest("#logoutBtn")) {
      localStorage.removeItem("4ndev_api_key");
      S.key = "";
      showOnboarding();
    }
  });

  window.__4nOpenConsole = openConsole;
  window.addEventListener("4n:open-console", openConsole);

  function init() {
    if (!S.key) {
      showOnboarding();
      return;
    }
    openConsole();
  }

  init();
})();