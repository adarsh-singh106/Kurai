/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/routes/environments.js]
 *
 * WHO I AM:    API route handler for Environment CRUD operations.
 * WHAT I OWN:  Defining paths for GET, POST, PUT, DELETE /api/environments.
 * WHAT I DON'T: The actual reading/writing to database or files (delegated to services/storageService.js).
 * WHO CALLS ME: server/index.js (Express app routing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import storageService from '../services/storageService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const list = await storageService.environments.list();
    res.json({ ok: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const newEnv = await storageService.environments.create(req.body);
    res.json({ ok: true, data: newEnv });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updatedEnv = await storageService.environments.update(req.params.id, req.body);
    res.json({ ok: true, data: updatedEnv });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await storageService.environments.delete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
