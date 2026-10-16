const db = require('../config/db');

/**
 * Get all boards where current user is owner or member
 * GET /api/boards
 */
function getAllBoards(req, res) {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        b.id,
        b.name,
        b.description,
        b.owner_id,
        b.created_at,
        bm.role as user_role,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) as total_tasks,
        (
          SELECT COUNT(*) 
          FROM tasks t 
          JOIN columns c ON t.column_id = c.id 
          WHERE t.board_id = b.id AND LOWER(c.name) = 'done'
        ) as completed_tasks,
        (SELECT COUNT(*) FROM board_members WHERE board_id = b.id) as member_count
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      JOIN users u ON b.owner_id = u.id
      WHERE bm.user_id = ?
      ORDER BY b.created_at DESC
    `;

    const boards = db.prepare(query).all(userId);
    return res.status(200).json({ boards });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return res.status(500).json({ error: 'Failed to retrieve boards' });
  }
}

/**
 * Create a new board inside a SQLite transaction
 * Populates owner in board_members and default columns: "To Do", "In Progress", "Done"
 * POST /api/boards
 */
function createBoard(req, res) {
  try {
    const { name, description } = req.body;
    const ownerId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Board name is required' });
    }

    const createTransaction = db.transaction((boardName, boardDesc, userId) => {
      // 1. Insert board
      const insertBoard = db.prepare(
        'INSERT INTO boards (name, description, owner_id) VALUES (?, ?, ?)'
      );
      const boardResult = insertBoard.run(boardName.trim(), boardDesc ? boardDesc.trim() : null, userId);
      const boardId = Number(boardResult.lastInsertRowid);

      // 2. Add owner to board_members
      const insertMember = db.prepare(
        'INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)'
      );
      insertMember.run(boardId, userId, 'owner');

      // 3. Populate default columns
      const insertColumn = db.prepare(
        'INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)'
      );
      insertColumn.run(boardId, 'To Do', 0);
      insertColumn.run(boardId, 'In Progress', 1);
      insertColumn.run(boardId, 'Done', 2);

      return boardId;
    });

    const newBoardId = createTransaction(name, description, ownerId);

    // Retrieve created board with columns
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(newBoardId);
    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC').all(newBoardId);

    return res.status(201).json({
      message: 'Board created successfully',
      board: {
        ...board,
        user_role: 'owner',
        columns
      }
    });
  } catch (error) {
    console.error('Error creating board:', error);
    return res.status(500).json({ error: 'Failed to create board' });
  }
}

/**
 * Get board details with columns, tasks, and members
 * GET /api/boards/:id
 */
function getBoardById(req, res) {
  try {
    const boardId = req.params.id;

    const board = db.prepare(`
      SELECT 
        b.id,
        b.name,
        b.description,
        b.owner_id,
        b.created_at,
        u.name as owner_name,
        u.email as owner_email
      FROM boards b
      JOIN users u ON b.owner_id = u.id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Get members
    const members = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        bm.role,
        bm.created_at as joined_at
      FROM board_members bm
      JOIN users u ON bm.user_id = u.id
      WHERE bm.board_id = ?
      ORDER BY CASE WHEN bm.role = 'owner' THEN 0 ELSE 1 END, u.name ASC
    `).all(boardId);

    // Get columns
    const columns = db.prepare(`
      SELECT id, board_id, name, position, created_at
      FROM columns
      WHERE board_id = ?
      ORDER BY position ASC
    `).all(boardId);

    // Get tasks
    const tasks = db.prepare(`
      SELECT 
        t.id,
        t.board_id,
        t.column_id,
        t.title,
        t.description,
        t.priority,
        t.due_date,
        t.assignee_id,
        t.created_by,
        t.position,
        t.created_at,
        t.updated_at,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name,
        (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comments_count
      FROM tasks t
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.board_id = ?
      ORDER BY t.position ASC
    `).all(boardId);

    // Group tasks into columns for easy frontend consumption
    const columnsWithTasks = columns.map(col => ({
      ...col,
      tasks: tasks.filter(t => t.column_id === col.id)
    }));

    return res.status(200).json({
      board: {
        ...board,
        user_role: req.boardMembership ? req.boardMembership.role : 'member',
        columns: columnsWithTasks,
        all_tasks: tasks,
        members
      }
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    return res.status(500).json({ error: 'Failed to retrieve board details' });
  }
}

/**
 * Update board details (Owner only)
 * PUT /api/boards/:id
 */
function updateBoard(req, res) {
  try {
    const boardId = req.params.id;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Board name is required' });
    }

    db.prepare(`
      UPDATE boards 
      SET name = ?, description = ? 
      WHERE id = ?
    `).run(name.trim(), description !== undefined ? (description ? description.trim() : null) : null, boardId);

    const updated = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
    return res.status(200).json({
      message: 'Board updated successfully',
      board: updated
    });
  } catch (error) {
    console.error('Error updating board:', error);
    return res.status(500).json({ error: 'Failed to update board' });
  }
}

/**
 * Delete board (Owner only)
 * DELETE /api/boards/:id
 */
function deleteBoard(req, res) {
  try {
    const boardId = req.params.id;

    // With PRAGMA foreign_keys = ON and ON DELETE CASCADE, child records are removed automatically
    const result = db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    return res.status(200).json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
}

/**
 * Add a member to the board by email (Owner only)
 * POST /api/boards/:id/members
 */
function addMember(req, res) {
  try {
    const boardId = req.params.id;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Member email is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(trimmedEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if already a member
    const existing = db.prepare(
      'SELECT id, role FROM board_members WHERE board_id = ? AND user_id = ?'
    ).get(boardId, user.id);

    if (existing) {
      return res.status(400).json({ error: 'User is already a member of this board' });
    }

    db.prepare(
      'INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)'
    ).run(boardId, user.id, 'member');

    return res.status(201).json({
      message: 'Member added successfully',
      member: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'member'
      }
    });
  } catch (error) {
    console.error('Error adding member:', error);
    return res.status(500).json({ error: 'Failed to add member to board' });
  }
}

/**
 * Remove a member from the board (Owner only)
 * DELETE /api/boards/:id/members/:userId
 */
function removeMember(req, res) {
  try {
    const boardId = req.params.id;
    const targetUserId = Number(req.params.userId);

    const board = db.prepare('SELECT owner_id FROM boards WHERE id = ?').get(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.owner_id === targetUserId) {
      return res.status(400).json({ error: 'Cannot remove the board owner' });
    }

    const member = db.prepare(
      'SELECT id FROM board_members WHERE board_id = ? AND user_id = ?'
    ).get(boardId, targetUserId);

    if (!member) {
      return res.status(404).json({ error: 'User is not a member of this board' });
    }

    // Remove member and unassign any tasks assigned to them on this board
    const removeTransaction = db.transaction(() => {
      db.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?').run(boardId, targetUserId);
      db.prepare('UPDATE tasks SET assignee_id = NULL WHERE board_id = ? AND assignee_id = ?').run(boardId, targetUserId);
    });

    removeTransaction();

    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ error: 'Failed to remove member from board' });
  }
}

module.exports = {
  getAllBoards,
  createBoard,
  getBoardById,
  updateBoard,
  deleteBoard,
  addMember,
  removeMember
};
