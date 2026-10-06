"use strict";

(function () {
  function initOnboarding() {
    const button = document.getElementById("createKeyBtn");
    const input = document.getElementById("developerName");
    const error = document.getElementById("createKeyError");

    if (!button || !input) return;

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
