/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/routes/history.js]
 *
 * WHO I AM:    API route handler for Request History operations.
 * WHAT I OWN:  Defining paths for GET and DELETE /api/history.
 * WHAT I DON'T: The actual reading/writing to database or files (delegated to services/storageService.js).
 * WHO CALLS ME: server/index.js (Express app routing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import storageService from '../services/storageService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const list = await storageService.history.list();
    res.json({ ok: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await storageService.history.clear();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
