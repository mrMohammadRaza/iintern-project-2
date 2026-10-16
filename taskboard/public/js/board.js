import { api, auth, showToast, escapeHtml, getInitials, formatDate, timeAgo } from './api.js';

// Central State
const state = {
  boardId: null,
  board: null,
  columns: [],
  allTasks: [],
  members: [],
  userRole: 'member',
  currentUser: null,
  isOwner: false,
  filters: {
    q: '',
    priority: '',
    assignee: ''
  },
  activeTaskId: null
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;

  state.currentUser = auth.getUser();
  setupUserNav();

  // Get board ID from query string
  const urlParams = new URLSearchParams(window.location.search);
  state.boardId = urlParams.get('id');

  if (!state.boardId) {
    showToast('No board ID specified in URL', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1500);
    return;
  }

  setupFilterListeners();
  setupModalListeners();
  await loadBoardData();
});

function setupUserNav() {
  if (state.currentUser) {
    const avatarEl = document.getElementById('nav-user-avatar');
    const nameEl = document.getElementById('nav-user-name');
    if (avatarEl) avatarEl.textContent = getInitials(state.currentUser.name);
    if (nameEl) nameEl.textContent = state.currentUser.name;
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.clearAuth();
      window.location.href = '/login.html';
    });
  }
}

/**
 * Fetch board data from API and sync state
 */
async function loadBoardData() {
  try {
    const data = await api.get(`/boards/${state.boardId}`);
    const b = data.board;
    state.board = b;
    state.columns = b.columns || [];
    state.allTasks = b.all_tasks || [];
    state.members = b.members || [];
    state.userRole = b.user_role || 'member';
    state.isOwner = state.userRole === 'owner';

    document.title = `${b.name} - TaskBoard`;
    renderBoardHeader();
    renderMembersDropdowns();
    renderBoard();
  } catch (error) {
    console.error('Failed to load board data:', error);
    showToast(error.message || 'Error loading board', 'error');
    const canvas = document.getElementById('kanban-canvas');
    if (canvas) {
      canvas.innerHTML = `
        <div style="padding: 40px; color: var(--danger); text-align: center; width: 100%;">
          <h3>Could not load board</h3>
          <p>${escapeHtml(error.message || 'Access denied or board not found')}</p>
          <a href="/dashboard.html" class="btn btn-secondary btn-sm" style="margin-top: 16px;">Return to Dashboard</a>
        </div>
      `;
    }
  }
}

/**
 * Render Header Bar (Title & Member Avatars)
 */
function renderBoardHeader() {
  const titleEl = document.getElementById('board-title');
  if (titleEl) {
    titleEl.textContent = state.board.name;
    if (state.isOwner) {
      titleEl.style.cursor = 'pointer';
      titleEl.title = 'Click to rename board';
      titleEl.onclick = renameBoardPrompt;
    } else {
      titleEl.style.cursor = 'default';
      titleEl.title = '';
      titleEl.onclick = null;
    }
  }

  // Render members stack
  const stack = document.getElementById('board-members-stack');
  if (stack) {
    stack.innerHTML = state.members.slice(0, 5).map(m => `
      <div class="member-avatar" title="${escapeHtml(m.name)} (${m.role})">
        ${getInitials(m.name)}
      </div>
    `).join('') + (state.members.length > 5 ? `
      <div class="member-avatar" style="background: var(--bg-card); font-size: 0.7rem;">
        +${state.members.length - 5}
      </div>
    ` : '');
  }
}

async function renameBoardPrompt() {
  const newName = prompt('Enter new board name:', state.board.name);
  if (newName && newName.trim() && newName.trim() !== state.board.name) {
    try {
      await api.put(`/boards/${state.boardId}`, {
        name: newName.trim(),
        description: state.board.description
      });
      state.board.name = newName.trim();
      document.title = `${state.board.name} - TaskBoard`;
      document.getElementById('board-title').textContent = state.board.name;
      showToast('Board renamed successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to rename board', 'error');
    }
  }
}

/**
 * Populate member dropdowns across search filters and modals
 */
function renderMembersDropdowns() {
  const filterAssignee = document.getElementById('filter-assignee');
  const taskAssignee = document.getElementById('task-assignee-select');
  const quickAssignee = document.getElementById('quick-task-assignee');

  const memberOptions = state.members.map(m => `
    <option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>
  `).join('');

  if (filterAssignee) {
    filterAssignee.innerHTML = `
      <option value="">All Assignees</option>
      <option value="unassigned">Unassigned Tasks</option>
      ${memberOptions}
    `;
    filterAssignee.value = state.filters.assignee;
  }

  if (taskAssignee) {
    taskAssignee.innerHTML = `
      <option value="">Unassigned</option>
      ${memberOptions}
    `;
  }

  if (quickAssignee) {
    quickAssignee.innerHTML = `
      <option value="">Unassigned</option>
      ${memberOptions}
    `;
  }
}

/**
 * Filter tasks based on active filters
 */
function getFilteredTasks() {
  let list = state.allTasks;
  const q = state.filters.q.toLowerCase().trim();
  const priority = state.filters.priority;
  const assignee = state.filters.assignee;

  if (q) {
    list = list.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  if (priority) {
    list = list.filter(t => t.priority === priority);
  }

  if (assignee !== '') {
    if (assignee === 'unassigned') {
      list = list.filter(t => !t.assignee_id);
    } else {
      list = list.filter(t => t.assignee_id == assignee);
    }
  }

  return list;
}

/**
 * Render complete Kanban Board UI
 */
function renderBoard() {
  const canvas = document.getElementById('kanban-canvas');
  if (!canvas) return;

  const filteredTasks = getFilteredTasks();
  const todayStr = new Date().toISOString().split('T')[0];

  // Build columns HTML
  const columnsHtml = state.columns.map(col => {
    // Filter tasks for this column and sort by position
    const colTasks = filteredTasks
      .filter(t => t.column_id === col.id)
      .sort((a, b) => a.position - b.position);

    const isDoneCol = col.name.trim().toLowerCase() === 'done';

    const tasksHtml = colTasks.map(task => {
      // Check overdue status
      const isOverdue = task.due_date && task.due_date < todayStr && !isDoneCol;

      return `
        <div 
          class="task-card ${isOverdue ? 'is-overdue' : ''}" 
          draggable="true" 
          data-task-id="${task.id}"
          data-column-id="${col.id}"
        >
          <div class="task-card-header">
            <span class="priority-pill priority-${task.priority}">
              ${task.priority}
            </span>
            ${task.assignee_name ? `
              <div class="user-avatar" style="width: 22px; height: 22px; font-size: 0.65rem;" title="Assigned to ${escapeHtml(task.assignee_name)}">
                ${getInitials(task.assignee_name)}
              </div>
            ` : ''}
          </div>

          <div class="task-title">${escapeHtml(task.title)}</div>

          <div class="task-card-footer">
            <div class="task-meta-left">
              ${task.due_date ? `
                <span class="due-date-pill ${isOverdue ? 'overdue' : ''}" title="${isOverdue ? 'Overdue!' : 'Due Date'}">
                  ${isOverdue ? '⚠️' : '📅'} ${formatDate(task.due_date)}
                </span>
              ` : ''}
            </div>

            ${(task.comments_count && task.comments_count > 0) ? `
              <span class="comments-count-pill" title="${task.comments_count} comment(s)">
                💬 ${task.comments_count}
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="kanban-column" data-column-id="${col.id}">
        <div class="column-header">
          <div class="column-title-group">
            <span class="column-name" data-column-id="${col.id}" title="Click to rename column">
              ${escapeHtml(col.name)}
            </span>
            <span class="column-count">${colTasks.length}</span>
          </div>

          <div class="column-actions">
            <button class="btn-icon btn-delete-column" data-column-id="${col.id}" data-column-name="${escapeHtml(col.name)}" title="Delete column">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="tasks-container" data-column-id="${col.id}">
          ${tasksHtml}
        </div>

        <div class="column-footer">
          <button class="btn-add-task" data-column-id="${col.id}" data-column-name="${escapeHtml(col.name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add a card
          </button>
        </div>
      </section>
    `;
  }).join('');

  // Add Column Form Card at the right end
  const addColumnHtml = `
    <div class="add-column-card">
      <h3 style="font-size: 0.95rem; font-weight: 600;">+ Add New Column</h3>
      <form id="add-column-form" style="display: flex; flex-direction: column; gap: 8px;">
        <input 
          type="text" 
          id="add-column-name-input" 
          class="form-control" 
          placeholder="Column title (e.g. QA, Review)..." 
          required
        >
        <button type="submit" class="btn btn-secondary btn-sm" style="width: 100%;">
          Add Column
        </button>
      </form>
    </div>
  `;

  canvas.innerHTML = columnsHtml + addColumnHtml;

  setupColumnEventListeners();
  setupDragAndDrop();
}

/**
 * Setup Column operations (Rename, Delete, Quick Add Task, Add Column)
 */
function setupColumnEventListeners() {
  // Add column form handler
  const addColForm = document.getElementById('add-column-form');
  if (addColForm) {
    addColForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('add-column-name-input');
      const name = input.value.trim();
      if (!name) return;

      try {
        const res = await api.post(`/boards/${state.boardId}/columns`, { name });
        state.columns.push(res.column);
        showToast(`Column "${name}" added`, 'success');
        renderBoard();
      } catch (err) {
        showToast(err.message || 'Failed to create column', 'error');
      }
    });
  }

  // Column rename on click
  document.querySelectorAll('.column-name').forEach(el => {
    el.addEventListener('click', async () => {
      const colId = el.dataset.columnId;
      const currentCol = state.columns.find(c => c.id == colId);
      if (!currentCol) return;

      const newName = prompt('Rename column:', currentCol.name);
      if (newName && newName.trim() && newName.trim() !== currentCol.name) {
        try {
          await api.put(`/columns/${colId}`, { name: newName.trim() });
          currentCol.name = newName.trim();
          showToast('Column renamed', 'success');
          renderBoard();
        } catch (err) {
          showToast(err.message || 'Failed to rename column', 'error');
        }
      }
    });
  });

  // Delete column button handler
  document.querySelectorAll('.btn-delete-column').forEach(btn => {
    btn.addEventListener('click', async () => {
      const colId = btn.dataset.columnId;
      const colName = btn.dataset.columnName;

      // Notice: backend blocks deletion if column has tasks and returns 400 error!
      if (confirm(`Are you sure you want to delete column "${colName}"?`)) {
        try {
          await api.delete(`/columns/${colId}`);
          state.columns = state.columns.filter(c => c.id != colId);
          showToast(`Column "${colName}" deleted`, 'success');
          renderBoard();
        } catch (err) {
          // Display the 400 blocked deletion error message clearly
          showToast(err.message || 'Cannot delete column with tasks', 'error', 4500);
        }
      }
    });
  });

  // Quick Add Task modal open
  document.querySelectorAll('.btn-add-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const colId = btn.dataset.columnId;
      const colName = btn.dataset.columnName;
      openQuickAddTaskModal(colId, colName);
    });
  });

  // Task card click to open detail modal
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if dragging
      if (card.classList.contains('is-dragging')) return;
      const taskId = card.dataset.taskId;
      openTaskDetailModal(taskId);
    });
  });
}

/**
 * Native HTML5 Drag and Drop Handlers
 * Implements: dragstart, dragover, dragenter, dragleave, drop, dragend
 */
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card');
  const dropZones = document.querySelectorAll('.tasks-container');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      const taskId = card.dataset.taskId;
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      // Clean up drop zones
      dropZones.forEach(zone => zone.classList.remove('drop-zone-active'));
    });
  });

  dropZones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      zone.classList.add('drop-zone-active');
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drop-zone-active');
      }
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drop-zone-active');

      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const targetColId = Number(zone.dataset.columnId);

      // Determine new position based on drop coordinates relative to other cards in zone
      const targetCards = [...zone.querySelectorAll('.task-card:not(.is-dragging)')];
      let newPosition = targetCards.length;

      for (let i = 0; i < targetCards.length; i++) {
        const rect = targetCards[i].getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;
        if (e.clientY < middleY) {
          newPosition = i;
          break;
        }
      }

      await executeTaskMove(taskId, targetColId, newPosition);
    });
  });
}

/**
 * Execute task movement via API and update state
 */
async function executeTaskMove(taskId, targetColumnId, newPosition) {
  try {
    const res = await api.patch(`/tasks/${taskId}/move`, {
      targetColumnId: Number(targetColumnId),
      newPosition: Number(newPosition)
    });

    // Refresh board data to sync contiguous positions across all tasks
    await loadBoardData();
    showToast('Task position updated', 'info', 1500);
  } catch (err) {
    console.error('Error moving task:', err);
    showToast(err.message || 'Failed to move task', 'error');
    await loadBoardData();
  }
}

/**
 * Task Detail Modal Handling
 */
async function openTaskDetailModal(taskId) {
  state.activeTaskId = taskId;
  const modal = document.getElementById('task-detail-modal');

  try {
    const data = await api.get(`/tasks/${taskId}`);
    const task = data.task;

    // Set Header Badges
    document.getElementById('modal-task-column-badge').textContent = task.column_name || 'Column';
    const prioBadge = document.getElementById('modal-task-priority-pill');
    prioBadge.className = `priority-pill priority-${task.priority}`;
    prioBadge.textContent = task.priority;

    // Populate Fields
    document.getElementById('task-title-input').value = task.title || '';
    document.getElementById('task-priority-select').value = task.priority || 'Medium';
    document.getElementById('task-due-date-input').value = task.due_date || '';
    document.getElementById('task-assignee-select').value = task.assignee_id || '';
    document.getElementById('task-desc-input').value = task.description || '';

    // Populate Fallback "Move to Column" Accessibility Dropdown
    const colSelect = document.getElementById('task-column-select');
    colSelect.innerHTML = state.columns.map(c => `
      <option value="${c.id}" ${c.id === task.column_id ? 'selected' : ''}>
        ${escapeHtml(c.name)} ${c.id === task.column_id ? '(Current)' : ''}
      </option>
    `).join('');

    // Render Comments
    renderComments(task.comments || []);

    // Render Activity Log
    renderActivities(task.activities || []);

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message || 'Failed to load task details', 'error');
  }
}

function renderComments(comments) {
  const container = document.getElementById('modal-comments-list');
  const countEl = document.getElementById('modal-comments-count');
  if (countEl) countEl.textContent = `(${comments.length})`;

  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-faint); padding: 12px 0;">
        No comments yet. Start the conversation!
      </div>
    `;
    return;
  }

  container.innerHTML = comments.map(c => {
    const isAuthor = state.currentUser && state.currentUser.id === c.user_id;

    return `
      <div class="comment-item" data-comment-id="${c.id}">
        <div class="comment-item-header">
          <div class="comment-author">
            <div class="user-avatar" style="width: 20px; height: 20px; font-size: 0.6rem;">
              ${getInitials(c.user_name)}
            </div>
            <span>${escapeHtml(c.user_name)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="comment-time">${timeAgo(c.created_at)}</span>
            ${isAuthor ? `
              <button class="btn-delete-comment" data-comment-id="${c.id}">
                Delete
              </button>
            ` : ''}
          </div>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
      </div>
    `;
  }).join('');

  // Attach delete listeners
  container.querySelectorAll('.btn-delete-comment').forEach(btn => {
    btn.addEventListener('click', async () => {
      const commentId = btn.dataset.commentId;
      try {
        await api.delete(`/comments/${commentId}`);
        showToast('Comment deleted', 'success');
        // Reload task details
        openTaskDetailModal(state.activeTaskId);
      } catch (err) {
        showToast(err.message || 'Failed to delete comment', 'error');
      }
    });
  });
}

function renderActivities(activities) {
  const container = document.getElementById('modal-activity-list');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-faint);">No activity logged yet.</div>`;
    return;
  }

  container.innerHTML = activities.map(a => `
    <div class="activity-item">
      <span class="activity-bullet">•</span>
      <div>
        <span><strong>${escapeHtml(a.user_name || 'System')}</strong>: ${escapeHtml(a.action)}</span>
        <span style="font-size: 0.75rem; color: var(--text-faint); margin-left: 6px;">(${timeAgo(a.created_at)})</span>
      </div>
    </div>
  `).join('');
}

/**
 * Setup All Modal Event Handlers
 */
function setupModalListeners() {
  const taskModal = document.getElementById('task-detail-modal');
  const closeTaskModal = () => {
    taskModal.classList.remove('active');
    state.activeTaskId = null;
    document.getElementById('new-comment-input').value = '';
  };

  document.getElementById('btn-close-task-modal')?.addEventListener('click', closeTaskModal);
  document.getElementById('btn-close-task-footer')?.addEventListener('click', closeTaskModal);

  taskModal?.addEventListener('click', (e) => {
    if (e.target === taskModal) closeTaskModal();
  });

  // Save Task Changes
  document.getElementById('btn-save-task-details')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;

    const title = document.getElementById('task-title-input').value.trim();
    const priority = document.getElementById('task-priority-select').value;
    const due_date = document.getElementById('task-due-date-input').value || null;
    const assigneeVal = document.getElementById('task-assignee-select').value;
    const description = document.getElementById('task-desc-input').value.trim();
    const selectedColumnId = Number(document.getElementById('task-column-select').value);

    if (!title) {
      showToast('Task title is required', 'warning');
      return;
    }

    const currentTask = state.allTasks.find(t => t.id == state.activeTaskId);

    try {
      // 1. Update task details
      await api.put(`/tasks/${state.activeTaskId}`, {
        title,
        priority,
        due_date,
        assignee_id: assigneeVal ? Number(assigneeVal) : null,
        description
      });

      // 2. Check if column was changed via Accessibility Fallback Dropdown
      if (currentTask && currentTask.column_id !== selectedColumnId) {
        // Move to the bottom of target column
        const targetTasks = state.allTasks.filter(t => t.column_id === selectedColumnId);
        await api.patch(`/tasks/${state.activeTaskId}/move`, {
          targetColumnId: selectedColumnId,
          newPosition: targetTasks.length
        });
      }

      showToast('Task updated successfully!', 'success');
      await loadBoardData();
      closeTaskModal();
    } catch (err) {
      showToast(err.message || 'Failed to update task', 'error');
    }
  });

  // Add Comment
  document.getElementById('btn-add-comment')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;
    const input = document.getElementById('new-comment-input');
    const content = input.value.trim();
    if (!content) {
      showToast('Please type a comment first', 'warning');
      return;
    }

    try {
      await api.post(`/tasks/${state.activeTaskId}/comments`, { content });
      input.value = '';
      showToast('Comment posted', 'success');
      // Refresh modal
      openTaskDetailModal(state.activeTaskId);
      // Refresh comments count on board
      await loadBoardData();
    } catch (err) {
      showToast(err.message || 'Failed to post comment', 'error');
    }
  });

  // Delete Task
  document.getElementById('btn-delete-task')?.addEventListener('click', async () => {
    if (!state.activeTaskId) return;

    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete(`/tasks/${state.activeTaskId}`);
        showToast('Task deleted successfully', 'success');
        closeTaskModal();
        await loadBoardData();
      } catch (err) {
        showToast(err.message || 'Failed to delete task', 'error');
      }
    }
  });

  // Quick Add Task Modal
  setupQuickAddModal();

  // Members Modal
  setupMembersModal();
}

function setupQuickAddModal() {
  const modal = document.getElementById('quick-add-task-modal');
  const closeBtn = document.getElementById('btn-close-quick-add');
  const cancelBtn = document.getElementById('btn-cancel-quick-add');
  const form = document.getElementById('quick-add-task-form');

  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const columnId = document.getElementById('quick-add-column-id').value;
    const title = document.getElementById('quick-task-title').value.trim();
    const priority = document.getElementById('quick-task-priority').value;
    const due_date = document.getElementById('quick-task-due').value || null;
    const assigneeVal = document.getElementById('quick-task-assignee').value;
    const description = document.getElementById('quick-task-desc').value.trim();

    if (!title) {
      showToast('Task title is required', 'warning');
      return;
    }

    try {
      await api.post(`/columns/${columnId}/tasks`, {
        title,
        priority,
        due_date,
        assignee_id: assigneeVal ? Number(assigneeVal) : null,
        description: description || null
      });

      showToast('Task added successfully', 'success');
      closeModal();
      await loadBoardData();
    } catch (err) {
      showToast(err.message || 'Failed to add task', 'error');
    }
  });
}

function openQuickAddTaskModal(columnId, columnName) {
  const modal = document.getElementById('quick-add-task-modal');
  document.getElementById('quick-add-column-id').value = columnId;
  document.getElementById('quick-add-column-title').textContent = `Add Task to "${columnName}"`;
  modal.classList.add('active');
  setTimeout(() => document.getElementById('quick-task-title').focus(), 100);
}

function setupMembersModal() {
  const modal = document.getElementById('members-modal');
  const openBtn = document.getElementById('btn-manage-members');
  const closeBtn = document.getElementById('btn-close-members-modal');
  const footerCloseBtn = document.getElementById('btn-close-members-footer');
  const addForm = document.getElementById('add-member-form');
  const addContainer = document.getElementById('add-member-container');

  const openModal = () => {
    // Only owner can add new members
    if (state.isOwner) {
      addContainer.style.display = 'block';
    } else {
      addContainer.style.display = 'none';
    }
    renderMembersListInModal();
    modal.classList.add('active');
  };

  const closeModal = () => modal.classList.remove('active');

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  footerCloseBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('new-member-email');
    const email = emailInput.value.trim();
    if (!email) return;

    try {
      const res = await api.post(`/boards/${state.boardId}/members`, { email });
      showToast(`Added ${res.member.name} to board`, 'success');
      emailInput.value = '';
      await loadBoardData();
      renderMembersListInModal();
    } catch (err) {
      showToast(err.message || 'Failed to add member', 'error');
    }
  });
}

function renderMembersListInModal() {
  const list = document.getElementById('modal-members-list');
  if (!list) return;

  list.innerHTML = state.members.map(m => {
    const isOwner = m.role === 'owner';
    const canRemove = state.isOwner && !isOwner;

    return `
      <div class="member-row">
        <div class="member-info">
          <div class="user-avatar" style="width: 28px; height: 28px;">
            ${getInitials(m.name)}
          </div>
          <div>
            <div style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(m.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(m.email)}</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="role-badge ${isOwner ? 'role-owner' : 'role-member'}">
            ${isOwner ? '👑 Owner' : '👤 Member'}
          </span>
          ${canRemove ? `
            <button class="btn btn-ghost btn-sm btn-remove-member" data-user-id="${m.id}" data-name="${escapeHtml(m.name)}" style="color: var(--danger);" title="Remove member">
              ✕
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Attach remove handlers
  list.querySelectorAll('.btn-remove-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.name;

      if (confirm(`Remove ${userName} from this board?`)) {
        try {
          await api.delete(`/boards/${state.boardId}/members/${userId}`);
          showToast(`Removed ${userName}`, 'info');
          await loadBoardData();
          renderMembersListInModal();
        } catch (err) {
          showToast(err.message || 'Failed to remove member', 'error');
        }
      }
    });
  });
}

/**
 * Filter Listeners (Search, Priority, Assignee)
 */
function setupFilterListeners() {
  const searchInput = document.getElementById('filter-search');
  const prioritySelect = document.getElementById('filter-priority');
  const assigneeSelect = document.getElementById('filter-assignee');
  const clearBtn = document.getElementById('btn-clear-filters');

  const updateFilters = () => {
    state.filters.q = searchInput.value;
    state.filters.priority = prioritySelect.value;
    state.filters.assignee = assigneeSelect.value;

    const hasActiveFilter = state.filters.q || state.filters.priority || state.filters.assignee;
    if (clearBtn) {
      clearBtn.style.display = hasActiveFilter ? 'inline-flex' : 'none';
    }

    renderBoard();
  };

  searchInput?.addEventListener('input', updateFilters);
  prioritySelect?.addEventListener('change', updateFilters);
  assigneeSelect?.addEventListener('change', updateFilters);

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    prioritySelect.value = '';
    assigneeSelect.value = '';
    updateFilters();
  });
}
