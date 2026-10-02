import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getUsage } from "../usage.js";

const router = express.Router();

router.use(requireApiKey());

router.get("/usage", (req, res) => {
  const records = getUsage(req.apiKey.id);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10) || 100, 1), 500);
  const offset = Math.max(Number.parseInt(req.query.offset || "0", 10) || 0, 0);
  const items = records.slice().reverse().slice(offset, offset + limit);

  res.json({
    success: true,
    usage: items,
    pagination: {
      limit,
      offset,
      total: records.length,
      has_more: offset + items.length < records.length
    }
  });
});

export default router;
