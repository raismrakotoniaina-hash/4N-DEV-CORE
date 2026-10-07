"use strict";

(function () {
  function initOnboarding() {
    const button = document.getElementById("createKeyBtn");
    const input = document.getElementById("developerName");
    const error = document.getElementById("createKeyError");
    const overview = document.getElementById("platformOverview");
    const createStep = document.getElementById("createKeyStep");
    const createdStep = document.getElementById("keyCreatedStep");
    const backButton = document.getElementById("backToPlatformBtn");
    const startButtons = [
      document.getElementById("startBuildingBtn"),
      document.getElementById("startAccessBtn")
    ].filter(Boolean);

    if (!button || !input) return;

    function openCreateStep() {
      overview?.classList.add("hidden");
      createStep?.classList.remove("hidden");
      createdStep?.classList.add("hidden");
      document.getElementById("platformAccess")?.scrollIntoView({behavior:"smooth", block:"center"});
      setTimeout(() => input.focus(), 250);
    }

    startButtons.forEach(item => item.addEventListener("click", event => {
      event.preventDefault();
      openCreateStep();
    }));

    backButton?.addEventListener("click", event => {
      event.preventDefault();
      createStep?.classList.add("hidden");
      createdStep?.classList.add("hidden");
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
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({name})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || ("HTTP " + response.status));
        if (!data.api_key) throw new Error("The Core API did not return an API key.");

        localStorage.setItem("4ndev_api_key", data.api_key);
        const created = document.getElementById("createdApiKey");
        if (created) created.value = data.api_key;
        createStep?.classList.add("hidden");
        overview?.classList.add("hidden");
        createdStep?.classList.remove("hidden");
        const copyStatus = document.getElementById("copyStatus");
        if (copyStatus) copyStatus.textContent = "Key created successfully.";
      } catch (err) {
        console.error("4N DEV onboarding error:", err);
        if (error) {
          error.textContent = err.message || "Unable to create API key.";
          error.classList.remove("hidden");
        }
      } finally {
        button.disabled = false;
        button.classList.remove("loading");
        button.innerHTML = "<span>Create API key</span><b>→</b>";
      }
    }

    button.addEventListener("click", event => {
      event.preventDefault();
      createKey();
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        createKey();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initOnboarding);
  else initOnboarding();
})();