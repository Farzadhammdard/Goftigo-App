import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import {generateId, now} from '../../utils/auth';
import type {Group} from '../../types';

const router = Router();

router.get('/', authMiddleware, requirePermission('groups.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '20', search = ''} = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * limit;

    let where = 'WHERE g.is_active = 1';
    const params: any[] = [];
    if (search) {
      where += ' AND (g.name LIKE ? OR g.description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s);
    }

    const total = queryScalar(db, `SELECT COUNT(*) as count FROM groups g ${where}`, params) || 0;
    const groups = queryAll(db, `
      SELECT g.id, g.name, g.description, g.avatar_url, g.creator_id, g.is_active, g.created_at,
        u.display_name as creator_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g LEFT JOIN users u ON g.creator_id = u.id
      ${where}
      ORDER BY g.created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: groups.map((g: any) => ({
        id: g.id, name: g.name, description: g.description, avatarUrl: g.avatar_url,
        creatorId: g.creator_id, creatorName: g.creator_name, memberCount: g.member_count,
        isActive: g.is_active, createdAt: g.created_at,
      })),
      meta: {page: pageNum, pageSize: limit, total, hasMore: offset + limit < total},
    });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list groups'}});
  }
});

router.get('/:id', authMiddleware, requirePermission('groups.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const group = queryOne(db, `
      SELECT g.*, u.display_name as creator_name
      FROM groups g LEFT JOIN users u ON g.creator_id = u.id WHERE g.id = ?
    `, [req.params.id]) as any;

    if (!group) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Group not found'}});
      return;
    }

    const members = queryAll(db, `
      SELECT gm.user_id, gm.role, gm.joined_at, u.display_name, u.username, u.avatar_url
      FROM group_members gm LEFT JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?
    `, [group.id]);

    res.json({
      success: true,
      data: {
        id: group.id, name: group.name, description: group.description, avatarUrl: group.avatar_url,
        creatorId: group.creator_id, creatorName: group.creator_name, memberCount: members.length,
        isActive: group.is_active, createdAt: group.created_at,
        members: members.map((m: any) => ({userId: m.user_id, displayName: m.display_name, username: m.username, avatarUrl: m.avatar_url, role: m.role, joinedAt: m.joined_at})),
      },
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get group'}});
  }
});

router.post('/', authMiddleware, requirePermission('groups.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {name, description, memberIds = []} = req.body;
    if (!name) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Group name required'}});
      return;
    }

    const db = await getDb();
    const id = generateId();
    const ts = now();

    runStatement(db, 'INSERT INTO groups (id, name, description, creator_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description || null, req.admin!.id, ts, ts]);
    runStatement(db, 'INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
      [id, req.admin!.id, 'admin', ts]);

    for (const uid of memberIds) {
      runStatement(db, 'INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [id, uid, 'member', ts]);
    }
    saveDb();

    logAuditAction(db, req.admin!.id, 'group.created', 'group', id, name);
    res.status(201).json({success: true, data: {id, name, description, createdAt: ts}});
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to create group'}});
  }
});

router.put('/:id', authMiddleware, requirePermission('groups.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const group = queryOne(db, 'SELECT * FROM groups WHERE id = ?', [req.params.id]) as Group | undefined;
    if (!group) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Group not found'}});
      return;
    }

    const {name, description} = req.body;
    if (name) { runStatement(db, 'UPDATE groups SET name = ?, updated_at = ? WHERE id = ?', [name, now(), req.params.id]); }
    if (description !== undefined) { runStatement(db, 'UPDATE groups SET description = ?, updated_at = ? WHERE id = ?', [description, now(), req.params.id]); }
    saveDb();

    logAuditAction(db, req.admin!.id, 'group.updated', 'group', group.id, group.name);
    res.json({success: true, data: {message: 'Group updated'}});
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update group'}});
  }
});

router.delete('/:id', authMiddleware, requirePermission('groups.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const group = queryOne(db, 'SELECT * FROM groups WHERE id = ?', [req.params.id]) as Group | undefined;
    if (!group) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Group not found'}});
      return;
    }

    runStatement(db, 'UPDATE groups SET is_active = 0, updated_at = ? WHERE id = ?', [now(), req.params.id]);
    saveDb();
    logAuditAction(db, req.admin!.id, 'group.deleted', 'group', group.id, group.name);
    res.json({success: true, data: {message: 'Group deleted'}});
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to delete group'}});
  }
});

export default router;
