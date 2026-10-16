const db = require('../config/db');

/**
 * Add a new column to a board with incremental position
 * POST /api/boards/:id/columns
 */
function addColumn(req, res) {
  try {
    const boardId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Column name is required' });
    }

    // Get the next position
    const maxPosRow = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS maxPos FROM columns WHERE board_id = ?'
    ).get(boardId);
    const newPosition = maxPosRow.maxPos + 1;

    const result = db.prepare(
      'INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)'
    ).run(boardId, name.trim(), newPosition);

    const newColumn = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      message: 'Column created successfully',
      column: {
        ...newColumn,
        tasks: []
      }
    });
  } catch (error) {
    console.error('Error adding column:', error);
    return res.status(500).json({ error: 'Failed to create column' });
  }
}

/**
 * Update column name or position
 * PUT /api/columns/:id
 */
function updateColumn(req, res) {
  try {
    const columnId = req.params.id;
    const { name, position } = req.body;

    const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const updateTransaction = db.transaction(() => {
      if (name && name.trim()) {
        db.prepare('UPDATE columns SET name = ? WHERE id = ?').run(name.trim(), columnId);
      }

      if (position !== undefined && position !== null && Number.isInteger(Number(position))) {
        const targetPos = Math.max(0, Number(position));
        const otherCols = db.prepare(
          'SELECT id FROM columns WHERE board_id = ? AND id != ? ORDER BY position ASC'
        ).all(column.board_id, columnId);

        // Splice into new position
        otherCols.splice(targetPos, 0, { id: Number(columnId) });

        // Update all positions
        const updatePosStmt = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
        otherCols.forEach((col, idx) => {
          updatePosStmt.run(idx, col.id);
        });
      }
    });

    updateTransaction();

    const updatedColumn = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);
    return res.status(200).json({
      message: 'Column updated successfully',
      column: updatedColumn
    });
  } catch (error) {
    console.error('Error updating column:', error);
    return res.status(500).json({ error: 'Failed to update column' });
  }
}

/**
 * Delete column
 * Block deletion if column contains tasks and return 400 error
 * DELETE /api/columns/:id
 */
function deleteColumn(req, res) {
  try {
    const columnId = req.params.id;

    const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Check if column contains any tasks
    const taskCountRow = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE column_id = ?'
    ).get(columnId);

    if (taskCountRow && taskCountRow.count > 0) {
      return res.status(400).json({
        error: `Cannot delete column that contains ${taskCountRow.count} task(s). Move or delete tasks first.`
      });
    }

    // Delete column and re-index remaining columns
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM columns WHERE id = ?').run(columnId);

      const remainingCols = db.prepare(
        'SELECT id FROM columns WHERE board_id = ? ORDER BY position ASC'
      ).all(column.board_id);

      const updatePosStmt = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
      remainingCols.forEach((col, idx) => {
        updatePosStmt.run(idx, col.id);
      });
    });

    deleteTransaction();

    return res.status(200).json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Error deleting column:', error);
    return res.status(500).json({ error: 'Failed to delete column' });
  }
}

module.exports = {
  addColumn,
  updateColumn,
  deleteColumn
};
