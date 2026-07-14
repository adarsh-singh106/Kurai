/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/routes/collections.js]
 *
 * WHO I AM:    API route handler for Collection CRUD operations.
 * WHAT I OWN:  Defining paths for GET, POST, PUT, PATCH, DELETE /api/collections.
 * WHAT I DON'T: The actual reading/writing to database or files (delegated to services/storageService.js).
 * WHO CALLS ME: server/index.js (Express app routing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import storageService from '../services/storageService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const list = await storageService.collections.list();
    res.json({ ok: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const newCollection = await storageService.collections.create(req.body);
    res.json({ ok: true, data: newCollection });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const collection = await storageService.collections.get(req.params.id);
    if (!collection) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Collection not found' } });
    }
    res.json({ ok: true, data: collection });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updatedCollection = await storageService.collections.update(req.params.id, req.body);
    res.json({ ok: true, data: updatedCollection });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await storageService.collections.delete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
