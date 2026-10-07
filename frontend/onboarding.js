"use strict";

(function () {
  function initOnboarding() {
    const button = document.getElementById("createKeyBtn");
    const input = document.getElementById("developerName");
    const error = document.getElementById("createKeyError");
    const overview = document.getElementById("platformOverview");
    const createStep = document.getElementById("createKeyStep");
    const backButton = document.getElementById("backToPlatformBtn");
    const topConsoleButton = document.getElementById("openConsoleTopBtn");
    const copyButton = document.getElementById("copyCreatedKey");
    const continueButton = document.getElementById("continueConsoleBtn");
    const startButtons = [
      document.getElementById("startBuildingBtn"),
      document.getElementById("startAccessBtn")
    ].filter(Boolean);

    if (!button || !input) return;

    function openCreateStep() {
      overview?.classList.add("hidden");
      createStep?.classList.remove("hidden");
      input.focus();
      document.getElementById("platformAccess")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    function openConsole() {
      const existingKey =
        localStorage.getItem("4ndev_api_key") ||
        window.__4nApiKey ||
        sessionStorage.getItem("4ndev_new_api_key") ||
        "";

      if (!existingKey) {
        openCreateStep();
        return;
      }

      localStorage.setItem("4ndev_api_key", existingKey);
      sessionStorage.removeItem("4ndev_new_api_key");
      window.location.assign("/console");
    }

    async function copyCreatedKeyNow() {
      const created = document.getElementById("createdApiKey");
      const status = document.getElementById("copyStatus");
      const value = created?.value || "";

      if (!value) {
        if (status) status.textContent = "No API key is available.";
        return;
      }

      let copied = false;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
          copied = true;
        }
      } catch (_) {}

      if (!copied) {
        const area = document.createElement("textarea");
        area.value = value;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        area.setSelectionRange(0, area.value.length);

        try {
          copied = document.execCommand("copy");
        } catch (_) {
          copied = false;
        }

        area.remove();
      }

      if (status) {
        status.textContent = copied
          ? "API key copied to clipboard."
          : "Copy failed. Long-press the key to copy it manually.";
      }
    }

    topConsoleButton?.addEventListener("click", openConsole);
    continueButton?.addEventListener("click", openConsole);
    copyButton?.addEventListener("click", copyCreatedKeyNow);

    startButtons.forEach((startButton) => {
      startButton.addEventListener("click", openCreateStep);
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
        try {
          data = await response.json();
        } catch (_) {}

        if (!response.ok) {
          throw new Error(data.error || data.message || ("HTTP " + response.status));
        }

        if (!data.api_key) {
          throw new Error("The Core API did not return an API key.");
        }

        window.__4nApiKey = data.api_key;
        sessionStorage.setItem("4ndev_new_api_key", data.api_key);

        const created = document.getElementById("createdApiKey");
        const createdStep = document.getElementById("keyCreatedStep");

        if (created) created.value = data.api_key;
        createStep?.classList.add("hidden");
        createdStep?.classList.remove("hidden");

        const status = document.getElementById("copyStatus");
        if (status) status.textContent = "Key created successfully.";
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
