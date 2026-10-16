import { api, auth, showToast, escapeHtml, getInitials } from './api.js';

let boardsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;

  setupUserProfile();
  setupModalEvents();
  await loadBoards();
});

function setupUserProfile() {
  const user = auth.getUser();
  if (user) {
    const avatarEl = document.getElementById('nav-user-avatar');
    const nameEl = document.getElementById('nav-user-name');
    if (avatarEl) avatarEl.textContent = getInitials(user.name);
    if (nameEl) nameEl.textContent = user.name;
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.clearAuth();
      showToast('Signed out successfully', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 500);
    });
  }
}

async function loadBoards() {
  const grid = document.getElementById('boards-grid');
  try {
    const data = await api.get('/boards');
    boardsList = data.boards || [];
    renderBoards();
  } catch (error) {
    console.error('Failed to load boards:', error);
    showToast(error.message || 'Failed to load boards', 'error');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
          Error loading boards. Please refresh or try again.
        </div>
      `;
    }
  }
}

function renderBoards() {
  const grid = document.getElementById('boards-grid');
  if (!grid) return;

  if (boardsList.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
        <div style="font-size: 3rem; margin-bottom: 12px;">📋</div>
        <h3 style="margin-bottom: 8px;">No Boards Found</h3>
        <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 20px auto;">
          You are not currently a member or owner of any boards. Create your first Kanban board to start tracking tasks!
        </p>
        <button class="btn btn-primary" onclick="document.getElementById('btn-open-create-board').click()">
          Create Your First Board
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = boardsList.map(board => {
    const isOwner = board.user_role === 'owner';
    const total = board.total_tasks || 0;
    const completed = board.completed_tasks || 0;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `
      <div class="board-card" data-board-id="${board.id}">
        <div>
          <div class="board-card-header">
            <a href="/board.html?id=${board.id}" class="board-card-title">
              ${escapeHtml(board.name)}
            </a>
            <span class="role-badge ${isOwner ? 'role-owner' : 'role-member'}">
              ${isOwner ? '👑 Owner' : '👤 Member'}
            </span>
          </div>

          <p class="board-card-desc">
            ${escapeHtml(board.description || 'No description provided for this board.')}
          </p>
        </div>

        <div>
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
              <span>Progress</span>
              <span>${progressPercent}% (${completed}/${total} tasks)</span>
            </div>
            <div style="width: 100%; height: 6px; background: var(--bg-card); border-radius: 999px; overflow: hidden;">
              <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(to right, var(--primary), #10b981); transition: width 0.3s ease;"></div>
            </div>
          </div>

          <div class="board-card-stats">
            <span class="stat-pill" title="Total Tasks">
              📌 ${total} tasks
            </span>
            <span class="stat-pill" title="Total Members">
              👥 ${board.member_count || 1} member${board.member_count === 1 ? '' : 's'}
            </span>
          </div>

          <div class="board-actions">
            <a href="/board.html?id=${board.id}" class="btn btn-secondary btn-sm" style="flex: 1;">
              Open Board →
            </a>
            ${isOwner ? `
              <button class="btn btn-ghost btn-sm btn-delete-board" data-id="${board.id}" data-name="${escapeHtml(board.name)}" title="Delete Board" style="color: var(--danger);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach delete listeners
  document.querySelectorAll('.btn-delete-board').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const boardId = btn.dataset.id;
      const boardName = btn.dataset.name;

      if (confirm(`Are you sure you want to permanently delete "${boardName}"? All columns, tasks, and comments will be deleted.`)) {
        try {
          await api.delete(`/boards/${boardId}`);
          showToast(`Board "${boardName}" deleted successfully`, 'success');
          boardsList = boardsList.filter(b => b.id != boardId);
          renderBoards();
        } catch (err) {
          showToast(err.message || 'Failed to delete board', 'error');
        }
      }
    });
  });
}

function setupModalEvents() {
  const modal = document.getElementById('create-board-modal');
  const openBtn = document.getElementById('btn-open-create-board');
  const closeBtn = document.getElementById('btn-close-create-board');
  const cancelBtn = document.getElementById('btn-cancel-create-board');
  const form = document.getElementById('create-board-form');
  const nameInput = document.getElementById('board-name-input');
  const descInput = document.getElementById('board-desc-input');

  const openModal = () => {
    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 100);
  };

  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Handle form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      showToast('Board name is required', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-create-board');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const res = await api.post('/boards', { name, description });
      showToast('Board created successfully!', 'success');
      closeModal();
      
      // Navigate directly to the newly created board
      if (res.board && res.board.id) {
        window.location.href = `/board.html?id=${res.board.id}`;
      } else {
        await loadBoards();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create board', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Board';
    }
  });
}
