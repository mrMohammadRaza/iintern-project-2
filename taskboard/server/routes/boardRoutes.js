const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const columnController = require('../controllers/columnController');
const taskController = require('../controllers/taskController');
const { verifyToken, requireBoardMember, requireBoardOwner } = require('../middleware/auth');

// All board routes require authentication
router.use(verifyToken);

// List all boards for authenticated user
router.get('/', boardController.getAllBoards);

// Create new board
router.post('/', boardController.createBoard);

// Get single board details (members only)
router.get('/:id', requireBoardMember, boardController.getBoardById);

// Update board (owner only)
router.put('/:id', requireBoardOwner, boardController.updateBoard);

// Delete board (owner only)
router.delete('/:id', requireBoardOwner, boardController.deleteBoard);

// Add member by email (owner only)
router.post('/:id/members', requireBoardOwner, boardController.addMember);

// Remove member from board (owner only)
router.delete('/:id/members/:userId', requireBoardOwner, boardController.removeMember);

// Add column to board (member or owner)
router.post('/:id/columns', requireBoardMember, columnController.addColumn);

// Search and filter tasks on this board
router.get('/:id/tasks', requireBoardMember, taskController.searchAndFilterTasks);

module.exports = router;
