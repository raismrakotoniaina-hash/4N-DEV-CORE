export function registerKeyOnboarding(app) {
  app.post("/v1/keys/create", (_req, res) => {
    res.status(501).json({ success: false, error: "API key onboarding is not implemented yet" });
  });
}
