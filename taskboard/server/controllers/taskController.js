const db = require('../config/db');

/**
 * Create a task at the bottom position of the target column
 * POST /api/columns/:id/tasks
 */
function createTask(req, res) {
  try {
    const columnId = req.params.id;
    const { title, description, priority = 'Medium', due_date, assignee_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const column = db.prepare('SELECT id, board_id FROM columns WHERE id = ?').get(columnId);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Verify user is a member of the board
    const member = db.prepare(
      'SELECT id FROM board_members WHERE board_id = ? AND user_id = ?'
    ).get(column.board_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this board' });
    }

    // Validate priority
    const validPriorities = ['Low', 'Medium', 'High'];
    const chosenPriority = validPriorities.includes(priority) ? priority : 'Medium';

    // Validate assignee if provided
    let validAssigneeId = null;
    if (assignee_id) {
      const assigneeMember = db.prepare(
        'SELECT id FROM board_members WHERE board_id = ? AND user_id = ?'
      ).get(column.board_id, assignee_id);
      if (assigneeMember) {
        validAssigneeId = Number(assignee_id);
      }
    }

    // Get bottom position
    const maxPosRow = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS maxPos FROM tasks WHERE column_id = ?'
    ).get(columnId);
    const nextPos = maxPosRow.maxPos + 1;

    const createTaskTransaction = db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO tasks (
          board_id, column_id, title, description, priority, 
          due_date, assignee_id, created_by, position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        column.board_id,
        columnId,
        title.trim(),
        description ? description.trim() : null,
        chosenPriority,
        due_date || null,
        validAssigneeId,
        req.user.id,
        nextPos
      );

      const newTaskId = Number(result.lastInsertRowid);

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (task_id, user_id, action) 
        VALUES (?, ?, ?)
      `).run(newTaskId, req.user.id, `Created task "${title.trim()}"`);

      return newTaskId;
    });

    const taskId = createTaskTransaction();

    // Fetch newly created task with relations
    const newTask = db.prepare(`
      SELECT 
        t.*,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name,
        0 as comments_count
      FROM tasks t
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.id = ?
    `).get(taskId);

    return res.status(201).json({
      message: 'Task created successfully',
      task: newTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
}

/**
 * Get task details with full comments list and activity log
 * GET /api/tasks/:id
 */
function getTaskById(req, res) {
  try {
    const taskId = req.params.id;

    const task = db.prepare(`
      SELECT 
        t.*,
        c.name as column_name,
        b.name as board_name,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name
      FROM tasks t
      JOIN columns c ON t.column_id = c.id
      JOIN boards b ON t.board_id = b.id
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.id = ?
    `).get(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get comments
    const comments = db.prepare(`
      SELECT 
        c.id,
        c.task_id,
        c.user_id,
        c.content,
        c.created_at,
        u.name as user_name,
        u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId);

    // Get activity log
    const activities = db.prepare(`
      SELECT 
        a.id,
        a.task_id,
        a.user_id,
        a.action,
        a.created_at,
        u.name as user_name
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
      LIMIT 30
    `).all(taskId);

    return res.status(200).json({
      task: {
        ...task,
        comments,
        activities
      }
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ error: 'Failed to retrieve task' });
  }
}

/**
 * Edit task details (title, description, priority, due_date, assignee_id)
 * PUT /api/tasks/:id
 */
function updateTask(req, res) {
  try {
    const taskId = req.params.id;
    const { title, description, priority, due_date, assignee_id } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const validPriorities = ['Low', 'Medium', 'High'];
    const updatedPriority = (priority && validPriorities.includes(priority)) ? priority : task.priority;

    let validAssigneeId = task.assignee_id;
    if (assignee_id !== undefined) {
      if (assignee_id === null || assignee_id === '' || assignee_id === 0) {
        validAssigneeId = null;
      } else {
        const member = db.prepare(
          'SELECT id FROM board_members WHERE board_id = ? AND user_id = ?'
        ).get(task.board_id, assignee_id);
        validAssigneeId = member ? Number(assignee_id) : null;
      }
    }

    const updatedTitle = (title && title.trim()) ? title.trim() : task.title;
    const updatedDesc = (description !== undefined) ? (description ? description.trim() : null) : task.description;
    const updatedDueDate = (due_date !== undefined) ? (due_date || null) : task.due_date;

    const updateTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE tasks 
        SET title = ?, description = ?, priority = ?, due_date = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(updatedTitle, updatedDesc, updatedPriority, updatedDueDate, validAssigneeId, taskId);

      // Log changes
      const changes = [];
      if (updatedTitle !== task.title) changes.push(`renamed to "${updatedTitle}"`);
      if (updatedPriority !== task.priority) changes.push(`priority changed to ${updatedPriority}`);
      if (validAssigneeId !== task.assignee_id) {
        if (validAssigneeId) {
          const assigneeUser = db.prepare('SELECT name FROM users WHERE id = ?').get(validAssigneeId);
          changes.push(`assigned to ${assigneeUser ? assigneeUser.name : 'user'}`);
        } else {
          changes.push('unassigned');
        }
      }
      if (updatedDueDate !== task.due_date) changes.push(`due date set to ${updatedDueDate || 'none'}`);

      if (changes.length > 0) {
        db.prepare(`
          INSERT INTO activity_log (task_id, user_id, action) 
          VALUES (?, ?, ?)
        `).run(taskId, req.user.id, `Task updated: ${changes.join(', ')}`);
      }
    });

    updateTransaction();

    const updatedTask = db.prepare(`
      SELECT 
        t.*,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name,
        (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comments_count
      FROM tasks t
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.id = ?
    `).get(taskId);

    return res.status(200).json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
}

/**
 * Delete a task and re-index contiguous positions in its column
 * DELETE /api/tasks/:id
 */
function deleteTask(req, res) {
  try {
    const taskId = req.params.id;

    const task = db.prepare('SELECT id, column_id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

      // Re-index remaining tasks in this column
      const remainingTasks = db.prepare(
        'SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC, id ASC'
      ).all(task.column_id);

      const updatePosStmt = db.prepare('UPDATE tasks SET position = ? WHERE id = ?');
      remainingTasks.forEach((t, idx) => {
        updatePosStmt.run(idx, t.id);
      });
    });

    deleteTransaction();

    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}

/**
 * Move a task (column change and/or position re-ordering)
 * Executes an SQL transaction re-indexing task positions contiguous (0...n) in both source and target columns
 * PATCH /api/tasks/:id/move
 */
function moveTask(req, res) {
  try {
    const taskId = req.params.id;
    const { targetColumnId, newPosition } = req.body;

    if (targetColumnId === undefined || newPosition === undefined) {
      return res.status(400).json({ error: 'targetColumnId and newPosition are required' });
    }

    const targetColId = Number(targetColumnId);
    let requestedPos = Number(newPosition);
    if (isNaN(requestedPos) || requestedPos < 0) requestedPos = 0;

    const moveTransaction = db.transaction(() => {
      // 1. Fetch current task
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // 2. Fetch source & target columns
      const sourceCol = db.prepare('SELECT * FROM columns WHERE id = ?').get(task.column_id);
      const targetCol = db.prepare('SELECT * FROM columns WHERE id = ?').get(targetColId);

      if (!targetCol) {
        throw new Error('Target column not found');
      }

      if (sourceCol && sourceCol.board_id !== targetCol.board_id) {
        throw new Error('Cannot move task to a different board');
      }

      const updatePosStmt = db.prepare('UPDATE tasks SET position = ? WHERE id = ?');

      // Case A: Moving within the SAME column
      if (task.column_id === targetColId) {
        let tasksInCol = db.prepare(
          'SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC, id ASC'
        ).all(targetColId);

        // Remove the task
        tasksInCol = tasksInCol.filter(t => t.id !== task.id);

        // Clamp requested position
        const insertIndex = Math.min(requestedPos, tasksInCol.length);
        tasksInCol.splice(insertIndex, 0, { id: task.id });

        // Re-index all contiguous (0...n)
        tasksInCol.forEach((t, idx) => {
          updatePosStmt.run(idx, t.id);
        });

        // Record activity log if position actually changed
        if (task.position !== insertIndex) {
          db.prepare(`
            INSERT INTO activity_log (task_id, user_id, action) 
            VALUES (?, ?, ?)
          `).run(task.id, req.user.id, `Reordered task in "${targetCol.name}" to position ${insertIndex + 1}`);
        }
      } else {
        // Case B: Moving across DIFFERENT columns
        // Step 1: Re-index remaining tasks in source column
        const sourceRemaining = db.prepare(
          'SELECT id FROM tasks WHERE column_id = ? AND id != ? ORDER BY position ASC, id ASC'
        ).all(task.column_id, task.id);

        sourceRemaining.forEach((t, idx) => {
          updatePosStmt.run(idx, t.id);
        });

        // Step 2: Prepare target column list
        let targetTasks = db.prepare(
          'SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC, id ASC'
        ).all(targetColId);

        const insertIndex = Math.min(requestedPos, targetTasks.length);
        targetTasks.splice(insertIndex, 0, { id: task.id });

        // Update target column ID and timestamp for the moved task
        db.prepare(`
          UPDATE tasks 
          SET column_id = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(targetColId, task.id);

        // Step 3: Re-index all tasks contiguous (0...n) in target column
        targetTasks.forEach((t, idx) => {
          updatePosStmt.run(idx, t.id);
        });

        // Record activity log
        const sourceName = sourceCol ? sourceCol.name : 'Unknown';
        db.prepare(`
          INSERT INTO activity_log (task_id, user_id, action) 
          VALUES (?, ?, ?)
        `).run(task.id, req.user.id, `Moved task from "${sourceName}" to "${targetCol.name}"`);
      }
    });

    moveTransaction();

    const updatedTask = db.prepare(`
      SELECT 
        t.*,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name,
        (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comments_count
      FROM tasks t
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.id = ?
    `).get(taskId);

    return res.status(200).json({
      message: 'Task moved successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error moving task:', error);
    if (error.message.includes('not found') || error.message.includes('board')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to move task' });
  }
}

/**
 * Search and filter tasks for a board
 * GET /api/boards/:id/tasks?q=&priority=&assignee=
 */
function searchAndFilterTasks(req, res) {
  try {
    const boardId = req.params.id;
    const { q, priority, assignee } = req.query;

    let sql = `
      SELECT 
        t.*,
        c.name as column_name,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_creator.name as creator_name,
        (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comments_count
      FROM tasks t
      JOIN columns c ON t.column_id = c.id
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.board_id = ?
    `;

    const params = [boardId];

    if (q && q.trim()) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const keyword = `%${q.trim()}%`;
      params.push(keyword, keyword);
    }

    if (priority && ['Low', 'Medium', 'High'].includes(priority)) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    if (assignee !== undefined && assignee !== '') {
      if (assignee === 'unassigned') {
        sql += ' AND t.assignee_id IS NULL';
      } else {
        sql += ' AND t.assignee_id = ?';
        params.push(Number(assignee));
      }
    }

    sql += ' ORDER BY t.column_id ASC, t.position ASC';

    const tasks = db.prepare(sql).all(...params);

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error searching tasks:', error);
    return res.status(500).json({ error: 'Failed to search tasks' });
  }
}

module.exports = {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  moveTask,
  searchAndFilterTasks
};
