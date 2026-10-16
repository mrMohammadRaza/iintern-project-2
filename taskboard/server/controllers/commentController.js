const db = require('../config/db');

/**
 * Add a comment to a task
 * POST /api/tasks/:id/comments
 */
function addComment(req, res) {
  try {
    const taskId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const task = db.prepare('SELECT id, board_id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user is member of board
    const member = db.prepare(
      'SELECT id FROM board_members WHERE board_id = ? AND user_id = ?'
    ).get(task.board_id, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this board' });
    }

    const commentTransaction = db.transaction(() => {
      const insertStmt = db.prepare(
        'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
      );
      const result = insertStmt.run(taskId, req.user.id, content.trim());
      const commentId = Number(result.lastInsertRowid);

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (task_id, user_id, action) 
        VALUES (?, ?, ?)
      `).run(taskId, req.user.id, `Added a comment: "${content.trim().slice(0, 40)}${content.trim().length > 40 ? '...' : ''}"`);

      return commentId;
    });

    const newCommentId = commentTransaction();

    const createdComment = db.prepare(`
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
      WHERE c.id = ?
    `).get(newCommentId);

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: createdComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * Delete a comment (Author only)
 * DELETE /api/comments/:id
 */
function deleteComment(req, res) {
  try {
    const commentId = req.params.id;

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify authorship
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the author can delete this comment' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    return res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
}

module.exports = {
  addComment,
  deleteComment
};
