import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getBalance } from "../credits.js";

const router = express.Router();

router.get("/credits", requireApiKey(), async (req, res, next) => {
  try {
    const credits = await getBalance(req.apiKey.id);

    res.json({
      success: true,
      credits
    });
  } catch (error) {
    next(error);
  }
});

export default router;
