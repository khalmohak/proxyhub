const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

const router = express.Router();

// GET /api/devices
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
             COUNT(l.id)::int AS total_requests
      FROM devices d
      LEFT JOIN proxy_logs l ON l.device_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/devices  — register a new device
router.post('/', async (req, res, next) => {
  const { name, description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const api_key = uuidv4();
  try {
    const result = await pool.query(
      'INSERT INTO devices (name, description, api_key) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), description || null, api_key]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/devices/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE devices SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/devices/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM devices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
