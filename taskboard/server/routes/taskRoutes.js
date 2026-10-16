const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');
const { verifyToken, requireTaskAccess } = require('../middleware/auth');

// All task routes require authentication
router.use(verifyToken);

// Get task details, full comments list, and activity log
router.get('/:id', requireTaskAccess, taskController.getTaskById);

// Update task
router.put('/:id', requireTaskAccess, taskController.updateTask);

// Delete task
router.delete('/:id', requireTaskAccess, taskController.deleteTask);

// Move task (re-indexes source and target columns contiguous 0...n)
router.patch('/:id/move', requireTaskAccess, taskController.moveTask);

// Add comment to task
router.post('/:id/comments', requireTaskAccess, commentController.addComment);

module.exports = router;
