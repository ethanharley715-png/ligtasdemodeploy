import { Router } from "express";
import { evaluateRules } from "../rules/engine";

const router = Router();

router.post("/check", (req, res) => {
  const input = req.body ?? {};
  const result = evaluateRules(input);
  res.json(result);
});

export default router;

