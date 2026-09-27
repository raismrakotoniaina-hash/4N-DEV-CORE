import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    name: "4N DEV Core API",
    status: "online",
    version: "0.1.0"
  });
});

app.get("/v1", (_req, res) => {
  res.json({
    name: "4N DEV API",
    version: "v1",
    endpoints: [
      "/v1/chat",
      "/v1/coding",
      "/v1/image",
      "/v1/embeddings",
      "/v1/projects",
      "/v1/files"
    ]
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`4N DEV Core API running on port ${PORT}`);
});
