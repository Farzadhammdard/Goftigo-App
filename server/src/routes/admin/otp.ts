import { Router, Response } from 'express';
import { getDb } from '../../db/connection';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// All OTP routes require admin auth
router.use(authMiddleware);

// GET /api/admin/otp — list recent OTP codes
// Query: ?search=+937...&page=1&pageSize=50&includeUsed=true
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const offset = (page - 1) * pageSize;
    const includeUsed = req.query.includeUsed !== 'false';
    const now = Date.now();

    let where = '1=1';
    const params: any[] = [];

    if (search) {
      where += ' AND (phone_number LIKE ? OR code LIKE ? OR session_id LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (!includeUsed) {
      where += ' AND used = 0';
    }

    // Total count
    const countRow = (db as any).exec(`SELECT COUNT(*) as cnt FROM otp_codes WHERE ${where}`, params);
    // Use helper queryOne pattern via exec
    let total = 0;
    try {
      const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM otp_codes WHERE ${where}`);
      if (search) {
        stmt.bind([`%${search}%`, `%${search}%`, `%${search}%`]);
      }
      if (stmt.step()) {
        const row: any = stmt.getAsObject();
        total = row.cnt || 0;
      }
      stmt.free();
    } catch {
      // fallback: count via query
      total = 0;
    }

    const stmt = db.prepare(
      `SELECT id, phone_number, code, session_id, expires_at, used, created_at
       FROM otp_codes
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    );
    const bindParams = [...params, pageSize, offset];
    stmt.bind(bindParams);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    // Enrich with computed status
    const data = rows.map((r: any) => {
      let status: string = 'valid';
      if (r.used) status = 'used';
      else if (r.expires_at <= now) status = 'expired';
      return {
        id: r.id,
        phoneNumber: r.phone_number,
        code: r.code,
        sessionId: r.session_id,
        expiresAt: r.expires_at,
        used: !!r.used,
        status,
        createdAt: r.created_at,
      };
    });

    // If total is 0 due to fallback, use data length for single page
    if (total === 0 && data.length > 0 && page === 1 && !search) {
      // try to get total via simple count
      try {
        const cStmt = db.prepare('SELECT COUNT(*) as cnt FROM otp_codes');
        if (cStmt.step()) total = (cStmt.getAsObject() as any).cnt || data.length;
        cStmt.free();
      } catch { total = data.length; }
    }

    res.json({
      success: true,
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    });
  } catch (error) {
    console.error('OTP list error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Failed to load OTP codes' } });
  }
});

// DELETE /api/admin/otp/cleanup — remove expired & used codes older than 24h
router.delete('/cleanup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    db.run('DELETE FROM otp_codes WHERE (used = 1 OR expires_at < ?) AND created_at < ?', [Date.now(), cutoff]);
    // sql.js needs save
    const { saveDb } = await import('../../db/connection');
    saveDb();
    res.json({ success: true, data: { message: 'Expired OTPs cleaned up' } });
  } catch (error) {
    console.error('OTP cleanup error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Failed to cleanup' } });
  }
});

export default router;
