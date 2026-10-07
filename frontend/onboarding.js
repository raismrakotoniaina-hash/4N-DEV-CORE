"use strict";

(function () {
  function initOnboarding() {
    const button = document.getElementById("createKeyBtn");
    const input = document.getElementById("developerName");
    const error = document.getElementById("createKeyError");
    const overview = document.getElementById("platformOverview");
    const createStep = document.getElementById("createKeyStep");
    const backButton = document.getElementById("backToPlatformBtn");
    const startButtons = [document.getElementById("startBuildingBtn"), document.getElementById("startAccessBtn")].filter(Boolean);\n    const topConsoleButton = document.getElementById("openConsoleTopBtn");\n    const copyButton = document.getElementById("copyCreatedKey");

    if (!button || !input) return;\n\n    async function copyCreatedKeyNow() {\n      const created = document.getElementById("createdApiKey");\n      const status = document.getElementById("copyStatus");\n      const value = created?.value || "";\n      if (!value) { if (status) status.textContent = "No API key is available."; return; }\n      let copied = false;\n      try {\n        if (navigator.clipboard && window.isSecureContext) {\n          await navigator.clipboard.writeText(value);\n          copied = true;\n        }\n      } catch (_) {}\n      if (!copied) {\n        const area = document.createElement("textarea");\n        area.value = value;\n        area.setAttribute("readonly", "");\n        area.style.position = "fixed";\n        area.style.left = "-9999px";\n        document.body.appendChild(area);\n        area.focus();\n        area.select();\n        area.setSelectionRange(0, area.value.length);\n        try { copied = document.execCommand("copy"); } catch (_) { copied = false; }\n        area.remove();\n      }\n      if (status) status.textContent = copied ? "API key copied to clipboard." : "Copy failed. Long-press the key to copy it manually.";\n    }\n\n    copyButton?.addEventListener("click", copyCreatedKeyNow);

    topConsoleButton?.addEventListener("click", function () {\n      const existingKey = localStorage.getItem("4ndev_api_key") || window.__4nApiKey || sessionStorage.getItem("4ndev_new_api_key") || "";\n      if (existingKey) {\n        localStorage.setItem("4ndev_api_key", existingKey);\n        sessionStorage.removeItem("4ndev_new_api_key");\n        window.location.assign("/console");\n        return;\n      }\n      overview?.classList.add("hidden");\n      createStep?.classList.remove("hidden");\n      input.focus();\n      document.getElementById("platformAccess")?.scrollIntoView({behavior:"smooth", block:"center"});\n    });\n\n    const continueButton = document.getElementById("continueConsoleBtn");
    continueButton?.addEventListener("click", function () {
      const createdKey = window.__4nApiKey || sessionStorage.getItem("4ndev_new_api_key") || "";
      if (!createdKey) {
        const status = document.getElementById("copyStatus");
        if (status) status.textContent = "No API key is available. Please create a new key.";
        return;
      }
      localStorage.setItem("4ndev_api_key", createdKey);
      sessionStorage.removeItem("4ndev_new_api_key");
      window.location.assign("/console");
    });

    startButtons.forEach((startButton) => {
      startButton.addEventListener("click", function () {
        overview?.classList.add("hidden");
        createStep?.classList.remove("hidden");
        input.focus();
        document.getElementById("platformAccess")?.scrollIntoView({behavior:"smooth", block:"center"});
      });
    });

    backButton?.addEventListener("click", function () {
      createStep?.classList.add("hidden");
      overview?.classList.remove("hidden");
    });

    async function createKey() {
      const name = (input.value || "").trim();
      if (error) {
        error.textContent = "";
        error.classList.add("hidden");
      }

      if (!name) {
        if (error) {
          error.textContent = "Developer or company name is required.";
          error.classList.remove("hidden");
        }
        input.focus();
        return;
      }

      button.disabled = true;
      button.classList.add("loading");
      button.innerHTML = "<span>Creating API key…</span><b>•</b>";

      try {
        const response = await fetch("/v1/keys/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });

        let data = {};
        try { data = await response.json(); } catch (_) {}

        if (!response.ok) {
          throw new Error(data.error || data.message || ("HTTP " + response.status));
        }

        if (!data.api_key) {
          throw new Error("The Core API did not return an API key.");
        }

        window.__4nApiKey = data.api_key;
        sessionStorage.setItem("4ndev_new_api_key", data.api_key);

        const created = document.getElementById("createdApiKey");
        const createStep = document.getElementById("createKeyStep");
        const createdStep = document.getElementById("keyCreatedStep");

        if (created) created.value = data.api_key;
        if (createStep) createStep.classList.add("hidden");
        if (createdStep) createdStep.classList.remove("hidden");

        const status = document.getElementById("copyStatus");
        if (status) status.textContent = "Key created successfully.";

        button.disabled = false;
      } catch (err) {
        console.error("4N DEV onboarding error:", err);
        if (error) {
          error.textContent = err.message || "Unable to create API key.";
          error.classList.remove("hidden");
        }
        button.disabled = false;
        button.classList.remove("loading");
        button.innerHTML = "<span>Create API key</span><b>→</b>";
      }
    }

    button.addEventListener("click", createKey);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        createKey();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnboarding);
  } else {
    initOnboarding();
  }
})();
