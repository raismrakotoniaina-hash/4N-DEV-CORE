import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getBalance } from "../credits.js";

const router = express.Router();

router.get("/credits", requireApiKey(), (req, res) => {
  res.json({
    success: true,
    credits: getBalance(req.apiKey.id)
  });
});

export default router;
