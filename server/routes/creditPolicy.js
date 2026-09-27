import express from "express";
import { getCreditPolicy } from "../creditPolicy.js";

const router = express.Router();

router.get("/credit-policy", (_req, res) => {
  res.json({
    success: true,
    policy: getCreditPolicy()
  });
});

export default router;
