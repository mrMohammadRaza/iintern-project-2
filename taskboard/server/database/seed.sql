-- Seed Data for TaskBoard
PRAGMA foreign_keys = ON;

-- Clear existing data if reseeding
DELETE FROM activity_log;
DELETE FROM comments;
DELETE FROM tasks;
DELETE FROM columns;
DELETE FROM board_members;
DELETE FROM boards;
DELETE FROM users;

-- 1. Insert Users (password for all is 'password123')
INSERT INTO users (id, name, email, password_hash) VALUES
(1, 'Demo Admin', 'demo@taskboard.com', '$2b$10$0SXyZN8t8HHL8ov/mrRE5u69i/2Zr5Rywmtxr7Z2QJK/BDP15yg22'),
(2, 'Alice Johnson', 'alice@taskboard.com', '$2b$10$0SXyZN8t8HHL8ov/mrRE5u69i/2Zr5Rywmtxr7Z2QJK/BDP15yg22'),
(3, 'Bob Smith', 'bob@taskboard.com', '$2b$10$0SXyZN8t8HHL8ov/mrRE5u69i/2Zr5Rywmtxr7Z2QJK/BDP15yg22'),
(4, 'Charlie Brown', 'charlie@taskboard.com', '$2b$10$0SXyZN8t8HHL8ov/mrRE5u69i/2Zr5Rywmtxr7Z2QJK/BDP15yg22');

-- 2. Insert Boards
INSERT INTO boards (id, name, description, owner_id) VALUES
(1, 'Sprint 42 - Q4 Core Platform', 'Main engineering sprint board covering architecture, security, and UI components.', 1),
(2, 'Marketing Website Redesign', 'Landing page, customer showcase, and branding overhaul for upcoming product launch.', 2);

-- 3. Insert Board Members
INSERT INTO board_members (board_id, user_id, role) VALUES
(1, 1, 'owner'),
(1, 2, 'member'),
(1, 3, 'member'),
(2, 2, 'owner'),
(2, 1, 'member');

-- 4. Insert Columns for Board 1
INSERT INTO columns (id, board_id, name, position) VALUES
(1, 1, 'To Do', 0),
(2, 1, 'In Progress', 1),
(3, 1, 'Code Review', 2),
(4, 1, 'Done', 3);

-- Columns for Board 2
INSERT INTO columns (id, board_id, name, position) VALUES
(5, 2, 'To Do', 0),
(6, 2, 'In Progress', 1),
(7, 2, 'Done', 2);

-- 5. Insert Tasks
-- Board 1 Tasks:
-- Task 1: Overdue task in To Do to test overdue red badge
INSERT INTO tasks (id, board_id, column_id, title, description, priority, due_date, assignee_id, created_by, position) VALUES
(1, 1, 1, 'Resolve database indexing bottleneck', 'Run EXPLAIN QUERY PLAN on board membership queries and add covering composite indexes.', 'High', '2026-10-10', 3, 1, 0),
(2, 1, 1, 'Add JWT token refresh endpoint', 'Support rolling session extensions without forcing user re-authentication.', 'Medium', '2026-10-25', 1, 1, 1),
(3, 1, 1, 'Write end-to-end API documentation', 'Document RESTful endpoints, query parameters, payload schemas, and response status codes.', 'Low', NULL, 4, 1, 2),
(4, 1, 2, 'Implement Native HTML5 Drag and Drop', 'Connect dragstart, dragover, drop, and dragend handlers with state updates and smooth visual feedback.', 'High', '2026-10-20', 2, 1, 0),
(5, 1, 3, 'Security audit on foreign key cascades', 'Verify ON DELETE CASCADE operates cleanly across users, boards, columns, and tasks.', 'Medium', '2026-10-22', 1, 1, 0),
(6, 1, 4, 'Design Trello-style UI theme', 'Implement CSS variables, glassmorphic card elements, and responsive layout across mobile and desktop.', 'Low', '2026-10-15', 2, 1, 0);

-- Board 2 Tasks:
INSERT INTO tasks (id, board_id, column_id, title, description, priority, due_date, assignee_id, created_by, position) VALUES
(7, 2, 5, 'Create high-fidelity landing page mockup', 'Produce Figma designs and review with team stakeholders.', 'High', '2026-10-28', 2, 2, 0),
(8, 2, 6, 'Draft copy for product feature grid', 'Highlight real-time kanban and drag-and-drop capabilities.', 'Medium', '2026-10-24', 1, 2, 0),
(9, 2, 7, 'Set up domain DNS records', 'Configure Cloudflare SSL and DNS pointers.', 'Low', '2026-10-12', 2, 2, 0);

-- 6. Insert Comments
INSERT INTO comments (id, task_id, user_id, content) VALUES
(1, 4, 2, 'Native HTML5 drag handlers are connected with dropzone visual indicators.'),
(2, 4, 1, 'Looks great! Make sure the fallback dropdown works for keyboard accessibility as well.'),
(3, 1, 3, 'Investigating index usage in SQLite PRAGMA index_list now.');

-- 7. Insert Activity Log
INSERT INTO activity_log (task_id, user_id, action) VALUES
(4, 1, 'Created task "Implement Native HTML5 Drag and Drop"'),
(4, 2, 'Moved task to "In Progress"'),
(4, 2, 'Added a comment: "Native HTML5 drag handlers are connected with dropzone visual indicators."'),
(1, 1, 'Created task "Resolve database indexing bottleneck"'),
(1, 3, 'Added a comment: "Investigating index usage in SQLite PRAGMA index_list now."');
