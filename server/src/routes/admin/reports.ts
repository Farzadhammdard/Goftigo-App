import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import type {Report} from '../../types';

const router = Router();

router.get('/', authMiddleware, requirePermission('reports.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '20', status = '', targetType = ''} = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status) { where += ' AND r.status = ?'; params.push(status); }
    if (targetType) { where += ' AND r.target_type = ?'; params.push(targetType); }

    const total = queryScalar(db, `SELECT COUNT(*) as count FROM reports r ${where}`, params) || 0;
    const reports = queryAll(db, `
      SELECT r.*, u.display_name as reporter_name, u.username as reporter_username, a.display_name as assigned_name
      FROM reports r LEFT JOIN users u ON r.reporter_id = u.id LEFT JOIN admin_users a ON r.assigned_to = a.id
      ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: reports.map((r: any) => ({
        id: r.id, reporterId: r.reporter_id, reporterName: r.reporter_name, reporterUsername: r.reporter_username,
        targetType: r.target_type, targetId: r.target_id, reason: r.reason, description: r.description,
        status: r.status, assignedTo: r.assigned_to, assignedName: r.assigned_name, resolution: r.resolution,
        createdAt: r.created_at, resolvedAt: r.resolved_at,
      })),
      meta: {page: pageNum, pageSize: limit, total, hasMore: offset + limit < total},
    });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list reports'}});
  }
});

router.get('/:id', authMiddleware, requirePermission('reports.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const report = queryOne(db, `
      SELECT r.*, u.display_name as reporter_name, u.username as reporter_username, a.display_name as assigned_name
      FROM reports r LEFT JOIN users u ON r.reporter_id = u.id LEFT JOIN admin_users a ON r.assigned_to = a.id
      WHERE r.id = ?
    `, [req.params.id]) as any;

    if (!report) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Report not found'}});
      return;
    }

    res.json({
      success: true,
      data: {
        id: report.id, reporterId: report.reporter_id, reporterName: report.reporter_name,
        reporterUsername: report.reporter_username, targetType: report.target_type, targetId: report.target_id,
        reason: report.reason, description: report.description, status: report.status,
        assignedTo: report.assigned_to, assignedName: report.assigned_name, resolution: report.resolution,
        createdAt: report.created_at, resolvedAt: report.resolved_at,
      },
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get report'}});
  }
});

router.put('/:id', authMiddleware, requirePermission('reports.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {status, assignedTo, resolution} = req.body;
    const db = await getDb();
    const report = queryOne(db, 'SELECT * FROM reports WHERE id = ?', [req.params.id]) as Report | undefined;
    if (!report) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Report not found'}});
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status && ['open', 'investigating', 'resolved', 'rejected'].includes(status)) {
      updates.push('status = ?'); params.push(status);
      if (status === 'resolved' || status === 'rejected') { updates.push('resolved_at = ?'); params.push(Date.now()); }
    }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(assignedTo || null); }
    if (resolution !== undefined) { updates.push('resolution = ?'); params.push(resolution || null); }

    if (updates.length === 0) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'No fields to update'}});
      return;
    }

    params.push(req.params.id);
    runStatement(db, `UPDATE reports SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDb();

    logAuditAction(db, req.admin!.id, 'report.updated', 'report', report.id, (report as any).reason);
    res.json({success: true, data: {message: 'Report updated'}});
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update report'}});
  }
});

export default router;
