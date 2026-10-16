const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-taskboard-jwt-key-2026-production-ready';

/**
 * Verify JWT token from Authorization header
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require board membership (owner or member)
 * Board ID is taken from req.params.id or req.params.boardId
 */
function requireBoardMember(req, res, next) {
  const boardId = req.params.boardId || req.params.id;
  if (!boardId) {
    return res.status(400).json({ error: 'Board ID is required' });
  }

  // Check if board exists
  const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  // Check user membership
  const member = db.prepare(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?'
  ).get(boardId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Access denied: You are not a member of this board' });
  }

  req.boardMembership = { boardId: Number(boardId), role: member.role };
  next();
}

/**
 * Require board owner role
 * Board ID is taken from req.params.id or req.params.boardId
 */
function requireBoardOwner(req, res, next) {
  const boardId = req.params.boardId || req.params.id;
  if (!boardId) {
    return res.status(400).json({ error: 'Board ID is required' });
  }

  const member = db.prepare(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?'
  ).get(boardId, req.user.id);

  if (!member || member.role !== 'owner') {
    return res.status(403).json({ error: 'Access denied: Owner privileges required' });
  }

  req.boardMembership = { boardId: Number(boardId), role: 'owner' };
  next();
}

/**
 * Middleware to check access to a column's board
 */
function requireColumnAccess(req, res, next) {
  const columnId = req.params.id;
  const column = db.prepare('SELECT id, board_id FROM columns WHERE id = ?').get(columnId);
  if (!column) {
    return res.status(404).json({ error: 'Column not found' });
  }

  const member = db.prepare(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?'
  ).get(column.board_id, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Access denied: Not a member of the board' });
  }

  req.column = column;
  req.boardMembership = { boardId: column.board_id, role: member.role };
  next();
}

/**
 * Middleware to check access to a task's board
 */
function requireTaskAccess(req, res, next) {
  const taskId = req.params.id || req.params.taskId;
  const task = db.prepare('SELECT id, board_id, column_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const member = db.prepare(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?'
  ).get(task.board_id, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Access denied: Not a member of the board' });
  }

  req.task = task;
  req.boardMembership = { boardId: task.board_id, role: member.role };
  next();
}

module.exports = {
  JWT_SECRET,
  verifyToken,
  requireBoardMember,
  requireBoardOwner,
  requireColumnAccess,
  requireTaskAccess
};
