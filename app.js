/* Tether v2 – compatible with the existing HTML, CSS and Firebase compat SDK. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORE_DEMO = 'tether-demo-state-v2';
  const STORE_OLD = 'tether-state';
  const PROMPTS = [
    'What small thing made you feel loved this week?',
    'Where would you go if tomorrow were completely free?',
    'What is one ordinary moment with me you never want to forget?',
    'What could I take off your plate this week?',
    'Which version of us makes you smile the most?',
    'What is something new you would like to try together?',
    'What is one way I can support you this week?',
    'Which memory makes you laugh every time?',
    'What would our perfect slow Sunday look like?',
    'What are you most excited for us to experience next?'
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const blankState = () => ({
    names: { me: 'You', partner: 'Your person' },
    anniversary: '', profiles: {}, moods: {}, messages: [], moments: [],
    plans: [], promptIndex: 0
  });
  const sampleState = () => ({
    ...blankState(), names: { me: 'Alex', partner: 'Jamie' },
    messages: [
      { id: 'sample-1', who: 'partner', text: 'Still thinking about our Sunday walk.', time: '9:42' },
      { id: 'sample-2', who: 'me', text: 'Same. Let’s take the long route again this week.', time: '9:45' }
    ],
    moments: [
      { id: 'sample-m1', title: 'Rainy-day ramen', date: 'Oct 12', note: 'The little place with the window seats.', tone: 'peach' },
      { id: 'sample-m2', title: 'The coast at dusk', date: 'Sep 28', note: 'Cold hands, loud waves, no rush to leave.', tone: 'ocean' }
    ],
    plans: [
      { id: 'sample-p1', title: 'Cook a new recipe', meta: 'Friday · at home', done: false },
      { id: 'sample-p2', title: 'Print our summer photos', meta: 'Someday list', done: true }
    ]
  });

  function normalize(raw) {
    const fallback = blankState();
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const asArray = (value, prefix) => Array.isArray(value) ? value.filter(
      x => x && typeof x === 'object' && !Array.isArray(x)
    ).map((x, i) => ({ ...x, id: String(x.id || `${prefix}-${i}`) })) : [];
    return {
      names: { ...fallback.names, ...(s.names && typeof s.names === 'object' ? s.names : {}) },
      anniversary: typeof s.anniversary === 'string' ? s.anniversary : '',
      profiles: s.profiles && typeof s.profiles === 'object' && !Array.isArray(s.profiles) ? s.profiles : {},
      moods: s.moods && typeof s.moods === 'object' && !Array.isArray(s.moods) ? s.moods : {},
      messages: asArray(s.messages, 'legacy-message'),
      moments: asArray(s.moments, 'legacy-moment'),
      plans: asArray(s.plans, 'legacy-plan'),
      promptIndex: Number.isInteger(s.promptIndex) && s.promptIndex >= 0 ? s.promptIndex : 0
    };
  }

  function loadDemo() {
    try {
      const stored = localStorage.getItem(STORE_DEMO);
      if (stored) return normalize(JSON.parse(stored));
      const old = JSON.parse(localStorage.getItem(STORE_OLD) || 'null');
      if (old && old.syncMode !== 'live') return normalize(old);
    } catch (error) { console.warn('Could not read the previous local demo:', error); }
    return sampleState();
  }

  const pad = n => String(n).padStart(2, '0');
  function localDay(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function previousDay(day) {
    const [year, month, date] = day.split('-').map(Number);
    return localDay(new Date(year, month - 1, date - 1));
  }
  function escapeHtml(input = '') {
    return String(input).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }
  function id() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), v => pad(v.toString(16))).join('');
  }
  function inviteCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(8);
    const chars = [];
    // Rejection sampling avoids modulo bias and is cryptographically secure.
    while (chars.length < 8) {
      crypto.getRandomValues(bytes);
      for (const value of bytes) {
        if (value < 224) chars.push(alphabet[value % alphabet.length]);
        if (chars.length === 8) break;
      }
    }
    return chars.join('');
  }
  function displayMood(state, day, userId) {
    const value = state.moods[day];
    if (typeof value === 'string') return userId === 'demo' ? value : null; // Legacy data has no sender identity.
    return value && typeof value === 'object' ? value[userId] || null : null;
  }
  function streakCount(state, userId) {
    let day = localDay();
    if (!displayMood(state, day, userId)) day = previousDay(day);
    let days = 0;
    while (days < 3660 && displayMood(state, day, userId)) {
      days++;
      day = previousDay(day);
    }
    return days;
  }
  function dateCount(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    if (start.getFullYear() !== y || start.getMonth() !== m - 1 || start.getDate() !== d) return null;
    const today = new Date();
    const diff = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d);
    return Math.max(0, Math.floor(diff / 86400000));
  }
  function formatDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  }
  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.classList.remove('show'), 3600);
  }

  let state = loadDemo();
  let remoteBase = blankState();
  let auth = null;
  let db = null;
  let provider = null;
  let firebaseAvailable = false;
  let currentUser = null;
  let activeCode = '';
  let memberIds = [];
  let unsubscribe = null;
  let queue = Promise.resolve();
  let pendingOps = [];
  let operationId = 0;
  let currentView = 'home';
  let demoState = clone(state);
  let installPrompt = null;

  const isLive = () => !!(currentUser && activeCode && db);
  const ownId = () => isLive() ? currentUser.uid : 'demo';
  const partnerId = () => memberIds.find(uid => uid !== ownId()) || null;
  function ownName() {
    return isLive() ? (state.profiles[ownId()]?.name || currentUser.displayName || 'You')
      : (state.names.me || 'You');
  }
  function partnerName() {
    if (!isLive()) return state.names.partner || 'Your person';
    const uid = partnerId();
    return (uid && state.profiles[uid]?.name) || 'Your person';
  }
  function persistDemo() {
    demoState = clone(state);
    try { localStorage.setItem(STORE_DEMO, JSON.stringify(demoState)); }
    catch (error) { console.warn('Local storage is unavailable', error); showToast('Device storage is full or unavailable'); }
  }
  function updateFromRemote() {
    state = normalize(remoteBase);
    for (const item of pendingOps) item.apply(state);
    render();
  }

  function edit(description, apply) {
    if (!isLive()) {
      apply(state);
      persistDemo();
      render();
      showToast(description);
      return;
    }
    const op = { id: ++operationId, apply };
    const code = activeCode;
    const userId = currentUser.uid;
    pendingOps.push(op);
    updateFromRemote();
    queue = queue.catch(() => {}).then(async () => {
      if (!currentUser || currentUser.uid !== userId || activeCode !== code) throw new Error('Space changed');
      const ref = db.collection('couples').doc(code);
      const updated = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists || !snapshot.data().memberIds?.includes(userId)) {
          throw new Error('You no longer have access to this shared space');
        }
        const next = normalize(snapshot.data().state);
        apply(next); // Repeatable/idempotent mutations only.
        transaction.update(ref, {
          state: next,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return next;
      });
      if (activeCode === code && currentUser?.uid === userId) {
        remoteBase = updated;
        pendingOps = pendingOps.filter(item => item.id !== op.id);
        updateFromRemote();
      }
    }).catch(error => {
      console.error(`Could not ${description.toLowerCase()}:`, error);
      if (activeCode === code) {
        pendingOps = pendingOps.filter(item => item.id !== op.id);
        updateFromRemote();
        showToast(`Not saved: ${error?.message || 'connection failed'}`);
      }
    });
  }

  function navigate(view) {
    if (!$$('.view').some(el => el.dataset.view === view)) return;
    currentView = view;
    $$('.view').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $$('.bottom-nav [data-go]').forEach(el => {
      const active = el.dataset.go === view;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderMessages() {
    const container = $('#messageList');
    if (!state.messages.length) {
      container.innerHTML = '<div class="empty-state chat-empty"><strong>Say hello ♡</strong>Your conversation starts here.</div>';
      return;
    }
    container.innerHTML = state.messages.slice(-250).map(message => {
      const mine = message.senderId ? message.senderId === ownId() : message.who === 'me';
      const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit'
      }) : String(message.time || '');
      return `<div class="message ${mine ? 'me' : 'partner'}"><p>${escapeHtml(message.text)}</p><time>${escapeHtml(time)}</time></div>`;
    }).join('');
  }
  function renderMoments() {
    $('#memoryCount').textContent = `${state.moments.length} ${state.moments.length === 1 ? 'memory' : 'memories'}`;
    $('#memoryGrid').innerHTML = state.moments.map(item => `
      <article class="memory-card ${['peach','ocean','gold'].includes(item.tone) ? item.tone : 'gold'}">
        <button class="item-delete" data-delete-memory="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}" title="Delete memory">×</button>
        <small>${escapeHtml(item.date || '')}</small>
        <h3>${escapeHtml(item.title || '')}</h3>
        <p>${escapeHtml(item.note || '')}</p>
      </article>
    `).join('') || '<div class="empty-state"><strong>A story worth saving</strong>Add a little moment you never want to forget.</div>';
  }
  function renderPlans() {
    const filter = $('.plan-filter .active')?.dataset.filter || 'all';
    const plans = state.plans.filter(item => filter === 'all' || (filter === 'done' ? !!item.done : !item.done));
    $('#plansList').innerHTML = plans.map(plan => `
      <article class="plan-row ${plan.done ? 'done' : ''}">
        <button class="plan-check" data-toggle-plan="${escapeHtml(plan.id)}"
          aria-label="Mark ${escapeHtml(plan.title)} ${plan.done ? 'not done' : 'done'}" aria-pressed="${!!plan.done}"></button>
        <div><h3>${escapeHtml(plan.title)}</h3><p>${escapeHtml(plan.scheduledAt ? formatDate(plan.scheduledAt) : (plan.meta || 'Someday list'))}</p></div>
        <button class="item-delete" data-delete-plan="${escapeHtml(plan.id)}" aria-label="Delete ${escapeHtml(plan.title)}" title="Delete plan">×</button>
      </article>
    `).join('') || '<div class="empty-state"><strong>Room for an adventure</strong>Add something to look forward to.</div>';
  }
  function renderNextPlan() {
    const article = $('.next-up .date-card');
    if (!article) return;
    const now = Date.now();
    const future = state.plans.filter(p => !p.done && p.scheduledAt && Date.parse(p.scheduledAt) >= now)
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    const next = future[0] || state.plans.find(p => !p.done);
    if (!next) {
      article.dataset.empty = 'true';
      article.innerHTML = '<div><h3>Your next adventure starts here</h3><p>Create a plan together and it will appear on your home screen.</p></div>';
      return;
    }
    delete article.dataset.empty;
    const date = next.scheduledAt ? new Date(next.scheduledAt) : null;
    const month = date ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date) : 'ONE';
    const day = date ? date.getDate() : '♡';
    article.innerHTML = `<div class="date-tile"><small>${escapeHtml(month.toUpperCase())}</small><strong>${day}</strong></div>
      <div><span class="soft-label">NEXT UP</span><h3>${escapeHtml(next.title)}</h3>
      <p>${escapeHtml(next.scheduledAt ? formatDate(next.scheduledAt) : (next.meta || 'Someday'))}</p></div>
      <button class="more-button" data-go="plans" aria-label="View all plans">→</button>`;
  }
  function renderIdentity() {
    const me = ownName(), partner = partnerName();
    const initials = value => String(value || '?').trim().charAt(0).toUpperCase();
    $('.avatar-me').textContent = initials(me);
    $('.avatar-partner').textContent = initials(partner);
    $('.large-avatars span:first-child').textContent = initials(me);
    $('.large-avatars span:last-child').textContent = initials(partner);
    const names = $('.couple-banner h1');
    if (names) names.innerHTML = `${escapeHtml(me)} <em>&amp;</em> ${escapeHtml(partner)}`;
    const anniversary = $('.couple-banner p');
    if (anniversary) anniversary.textContent = state.anniversary ?
      `Together since ${formatDate(`${state.anniversary}T12:00:00`)}` : 'Your story, your own timeline';
    const days = dateCount(state.anniversary);
    const counter = $('.couple-stat strong');
    if (counter) counter.textContent = days === null ? '—' : String(days);
    const greeting = $('.home-hero h1');
    if (greeting) greeting.innerHTML = `A little time for<br><em>${escapeHtml(me)} &amp; ${escapeHtml(partner)}.</em>`;
    const input = $('#chatInput');
    if (input) input.placeholder = `Write to ${partner}…`;
    const currentMood = displayMood(state, localDay(), ownId());
    $$('.mood-options button').forEach(button => {
      const chosen = button.dataset.mood === currentMood;
      button.classList.toggle('selected', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    const status = $('.status-dot');
    status.style.background = currentMood ? 'var(--sage)' : '#cbbdb2';
    status.title = currentMood ? 'Checked in today' : 'Not checked in today';
    const other = $('.partner-checkin');
    const partnerMood = partnerId() ? displayMood(state, localDay(), partnerId()) : null;
    if (other) {
      other.hidden = !partnerMood;
      if (partnerMood) other.innerHTML = `<span class="mini-avatar">${escapeHtml(initials(partner))}</span>
        <span>${escapeHtml(partner)} checked in</span><strong>${escapeHtml(partnerMood.toUpperCase())}</strong>`;
    }
  }
  function renderSync() {
    const codeBox = $('#inviteCode');
    codeBox.hidden = !activeCode;
    if (activeCode) $('strong', codeBox).textContent = activeCode;
    const badge = $('#syncBadge');
    badge.classList.remove('live', 'waiting', 'error');
    if (isLive()) {
      const connected = memberIds.length === 2;
      badge.textContent = connected ? 'CONNECTED' : 'WAITING';
      badge.classList.add(connected ? 'live' : 'waiting');
      $('#syncTitle').textContent = connected ? 'Your phones are connected' : 'Invite your person';
      $('#syncDescription').textContent = connected ?
        'Your shared space syncs securely through Firestore.' :
        'Send your private code to your partner. They can join after signing in.';
    } else {
      badge.textContent = 'DEMO';
      $('#syncTitle').textContent = currentUser ? 'Create or join a shared space' : 'Connect your two phones';
      $('#syncDescription').textContent = currentUser ?
        'You are signed in. Create a space or enter a private invite code.' :
        'Preview locally, or sign in with Google to create a real shared space.';
    }
    $('#createSpace').disabled = isLive() || !firebaseAvailable;
    $('#joinSpace').disabled = isLive() || !firebaseAvailable;
    const signOut = $('#signOut');
    if (signOut) signOut.hidden = !currentUser;
  }
  function render() {
    $('#todayLabel').textContent = new Intl.DateTimeFormat(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date()).toUpperCase();
    $('#streakCount').textContent = streakCount(state, ownId());
    $('#dailyPrompt').textContent = `“${PROMPTS[state.promptIndex % PROMPTS.length]}”`;
    renderIdentity();
    renderMessages();
    renderMoments();
    renderPlans();
    renderNextPlan();
    renderSync();
  }

  function setupExtraUI() {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = './enhancements.css';
    document.head.append(style);
    // Original HTML contains an "Important dates" button that targets a missing dialog.
    // Reuse it to open real settings until dedicated milestone support is added.
    const settings = $('.settings-list');
    if (settings) {
      const buttons = $$('button', settings);
      if (buttons[0]) { buttons[0].dataset.open = 'preferencesModal'; }
      if (buttons[1]) { buttons[1].dataset.open = 'preferencesModal'; }
      settings.insertAdjacentHTML('beforeend', `
        <button id="exportData" type="button"><span class="setting-icon">04</span><span><strong>Export your data</strong><small>Download your messages, moments and plans</small></span><b>›</b></button>
        <button id="signOut" type="button" hidden><span class="setting-icon">05</span><span><strong>Sign out</strong><small>Leave this device securely</small></span><b>›</b></button>`);
    }
    const planForm = $('#planForm');
    planForm.querySelector('[name="title"]').maxLength = 120;
    planForm.querySelector('[name="meta"]').maxLength = 200;
    planForm.querySelector('.form-actions').insertAdjacentHTML('beforebegin',
      '<label>When? (optional)<input name="scheduledAt" type="datetime-local"></label>');
    const memoryForm = $('#memoryForm');
    memoryForm.querySelector('[name="title"]').maxLength = 120;
    memoryForm.querySelector('[name="note"]').maxLength = 2000;
    $('#chatInput').maxLength = 2000;
    const attachment = $('.attach-button');
    if (attachment) {
      attachment.disabled = true;
      attachment.title = 'Photo attachments are coming later';
      attachment.setAttribute('aria-label', 'Attachments not available yet');
    }
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="preferencesModal" class="sheet-modal">
        <form id="preferencesForm" method="dialog">
          <div class="sheet-handle"></div>
          <div class="modal-title"><div><span class="kicker">MAKE IT YOURS</span><h2>Our details.</h2></div><button value="cancel" aria-label="Close">×</button></div>
          <label>Your name<input name="yourName" maxlength="40" required placeholder="Your name"></label>
          <label id="partnerNameField">Partner name<input name="partnerName" maxlength="40" placeholder="Their name"></label>
          <label>Anniversary date<input type="date" name="anniversary"></label>
          <div class="form-actions"><button value="cancel">Cancel</button><button id="savePreferences" value="default">Save details</button></div>
        </form>
      </dialog>`);
  }
  function openPreferences() {
    const form = $('#preferencesForm');
    form.elements.yourName.value = ownName();
    form.elements.partnerName.value = partnerName();
    form.elements.anniversary.value = state.anniversary;
    $('#partnerNameField').hidden = isLive();
    $('#preferencesModal').showModal();
  }
  function exportData() {
    const json = JSON.stringify({
      exportedAt: new Date().toISOString(),
      mode: isLive() ? 'shared' : 'demo',
      state
    }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tether-export-${localDay()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Your data export was downloaded');
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const go = event.target.closest('[data-go]');
      if (go) { navigate(go.dataset.go); return; }
      const modalButton = event.target.closest('[data-open]');
      if (modalButton) {
        const modal = $(`#${modalButton.dataset.open}`);
        if (modal?.showModal) {
          if (modal.id === 'preferencesModal') openPreferences();
          else modal.showModal();
        }
      }
    });
    $$('.mood-options button').forEach(button => button.addEventListener('click', () => {
      const day = localDay(), uid = ownId(), mood = button.dataset.mood;
      edit('Check-in saved', next => {
        const old = next.moods[day];
        const dayMoods = old && typeof old === 'object' ? { ...old } : {};
        dayMoods[uid] = mood;
        next.moods[day] = dayMoods;
      });
    }));
    $('#shufflePrompt').addEventListener('click', () => edit('New question selected', next => {
      next.promptIndex = (next.promptIndex + 1) % PROMPTS.length;
    }));
    $('#answerPrompt').addEventListener('click', () => {
      navigate('chat');
      $('#chatInput').value = 'My answer: ';
      $('#chatInput').focus();
    });
    $('#chatForm').addEventListener('submit', event => {
      event.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      const message = {
        id: id(), text: text.slice(0, 2000), senderId: ownId(),
        createdAt: new Date().toISOString()
      };
      edit('Message sent', next => {
        if (!next.messages.some(item => item.id === message.id)) next.messages.push(message);
      });
      input.value = '';
      $('#messageList').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#memoryForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const moment = {
        id: id(), title: String(values.get('title') || '').trim().slice(0, 120),
        note: String(values.get('note') || '').trim().slice(0, 2000),
        date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()),
        tone: ['peach', 'ocean', 'gold'][state.moments.length % 3]
      };
      if (!moment.title) return;
      edit('Memory saved', next => {
        if (!next.moments.some(item => item.id === moment.id)) next.moments.unshift(moment);
      });
      form.reset();
      $('#memoryModal').close();
    });
    $('#planForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const dateInput = String(values.get('scheduledAt') || '');
      const plan = {
        id: id(), title: String(values.get('title') || '').trim().slice(0, 120),
        meta: String(values.get('meta') || '').trim().slice(0, 200),
        scheduledAt: dateInput ? new Date(dateInput).toISOString() : '',
        done: false
      };
      if (!plan.title) return;
      edit('Plan added', next => {
        if (!next.plans.some(item => item.id === plan.id)) next.plans.unshift(plan);
      });
      form.reset();
      $('#planModal').close();
    });
    $('#plansList').addEventListener('click', event => {
      const toggle = event.target.closest('[data-toggle-plan]');
      if (toggle) {
        const plan = state.plans.find(item => item.id === toggle.dataset.togglePlan);
        if (!plan) return;
        const done = !plan.done;
        edit('Plan updated', next => {
          const match = next.plans.find(item => item.id === plan.id);
          if (match) match.done = done;
        });
        return;
      }
      const remove = event.target.closest('[data-delete-plan]');
      if (remove && confirm('Delete this plan for both of you?')) {
        const planId = remove.dataset.deletePlan;
        edit('Plan deleted', next => { next.plans = next.plans.filter(item => item.id !== planId); });
      }
    });
    $('#memoryGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-delete-memory]');
      if (button && confirm('Delete this memory for both of you?')) {
        const memoryId = button.dataset.deleteMemory;
        edit('Memory deleted', next => { next.moments = next.moments.filter(item => item.id !== memoryId); });
      }
    });
    $$('.plan-filter button').forEach(button => button.addEventListener('click', () => {
      $$('.plan-filter button').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-selected', String(item === button));
      });
      renderPlans();
    }));
    $('#preferencesForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const name = form.elements.yourName.value.trim().slice(0, 40);
      const other = form.elements.partnerName.value.trim().slice(0, 40);
      const anniversary = form.elements.anniversary.value;
      if (!name) return;
      const userId = ownId();
      edit('Preferences saved', next => {
        next.anniversary = anniversary;
        if (userId === 'demo') {
          next.names = { me: name, partner: other || 'Your person' };
        } else {
          next.profiles[userId] = { name };
        }
      });
      $('#preferencesModal').close();
    });
    $('#copyCode').addEventListener('click', async () => {
      if (!activeCode) return;
      try { await navigator.clipboard.writeText(activeCode); showToast('Private code copied'); }
      catch { showToast('Please select and copy the code shown above'); }
    });
    $('#resetDemo').addEventListener('click', () => {
      if (isLive()) { showToast('Demo reset is unavailable while connected'); return; }
      if (!confirm('Clear all demo data on this device?')) return;
      state = blankState();
      persistDemo();
      render();
      navigate('home');
      showToast('Local demo data cleared');
    });
    $('#exportData').addEventListener('click', exportData);
    $('#signOut').addEventListener('click', () => auth?.signOut().catch(error => showToast(error.message)));
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
    $('#installButton').addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      } else showToast('Choose “Add to Home Screen” from your browser menu');
    });
    window.addEventListener('storage', event => {
      if (!isLive() && event.key === STORE_DEMO && event.newValue) {
        try { state = normalize(JSON.parse(event.newValue)); render(); }
        catch { /* ignore invalid external storage */ }
      }
    });
    window.addEventListener('online', () => showToast('You are back online'));
    window.addEventListener('offline', () => showToast('Offline — shared changes need a connection'));
  }

  function clearWatch() {
    unsubscribe?.();
    unsubscribe = null;
    pendingOps = [];
    queue = Promise.resolve();
    activeCode = '';
    memberIds = [];
  }
  function watch(code) {
    clearWatch();
    activeCode = code;
    remoteBase = blankState();
    state = blankState();
    render();
    const uid = currentUser?.uid;
    unsubscribe = db.collection('couples').doc(code).onSnapshot(snapshot => {
      if (!currentUser || currentUser.uid !== uid || activeCode !== code) return;
      if (!snapshot.exists || !snapshot.data().memberIds?.includes(uid)) {
        showToast('This shared space is unavailable');
        clearWatch();
        state = clone(demoState);
        render();
        return;
      }
      memberIds = snapshot.data().memberIds;
      remoteBase = normalize(snapshot.data().state);
      updateFromRemote();
    }, error => {
      console.error('Firestore sync listener failed', error);
      showToast('Could not open this space. Check access and connection.');
      clearWatch();
      state = clone(demoState);
      render();
    });
  }
  async function signIn() {
    if (currentUser) return currentUser;
    try { return (await auth.signInWithPopup(provider)).user; }
    catch (error) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
        await auth.signInWithRedirect(provider);
        return null;
      }
      throw error;
    }
  }
  async function requireUser() { return currentUser || await signIn(); }
  async function createSpace() {
    try {
      if (isLive()) return showToast('You already have a shared space');
      const user = await requireUser();
      if (!user) return;
      const initial = blankState();
      initial.profiles[user.uid] = { name: user.displayName || 'You' };
      let code = '';
      // A collision cannot overwrite another couple; rules disallow that write.
      for (let attempt = 0; attempt < 5; attempt++) {
        code = inviteCode();
        try {
          await db.collection('couples').doc(code).set({
            memberIds: [user.uid], createdBy: user.uid, state: initial,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          break;
        } catch (error) {
          if (error.code !== 'permission-denied' || attempt === 4) throw error;
          code = '';
        }
      }
      if (!code) throw new Error('Could not generate a new invite code');
      localStorage.setItem(`tether-space:${user.uid}`, code);
      watch(code);
      showToast('Space created. Share your private code with your partner.');
      navigate('us');
    } catch (error) { console.error(error); showToast(`Could not create space: ${error.message}`); }
  }
  async function joinSpace() {
    try {
      if (isLive()) return showToast('You already have a shared space');
      const user = await requireUser();
      if (!user) return;
      const answer = prompt('Enter your private invitation code');
      if (answer === null) return;
      const code = answer.trim().toUpperCase();
      if (!/^[A-Z0-9]{6,8}$/.test(code)) return showToast('Enter a valid 6- or 8-character code');
      await db.collection('couples').doc(code).update({
        memberIds: firebase.firestore.FieldValue.arrayUnion(user.uid)
      });
      localStorage.setItem(`tether-space:${user.uid}`, code);
      watch(code);
      // Add your own name only after the membership update succeeds.
      const name = user.displayName || 'You';
      edit('Profile added', next => { next.profiles[user.uid] = next.profiles[user.uid] || { name }; });
      showToast('You are now connected');
      navigate('us');
    } catch (error) { console.error(error); showToast('Could not join. Check your invite code.'); }
  }
  function initFirebase() {
    const config = window.TETHER_FIREBASE_CONFIG;
    if (!config || typeof firebase === 'undefined') {
      $('#googleSignIn').disabled = true;
      $('#createSpace').disabled = true;
      $('#joinSpace').disabled = true;
      showToast('Firebase is unavailable. You can still explore the local demo.');
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth();
      db = firebase.firestore();
      firebaseAvailable = true;
      provider = new firebase.auth.GoogleAuthProvider();
      $('#googleSignIn').addEventListener('click', () => {
        signIn().catch(error => { console.error(error); showToast(`Sign-in failed: ${error.message}`); });
      });
      $('#createSpace').addEventListener('click', createSpace);
      $('#joinSpace').addEventListener('click', joinSpace);
      auth.onAuthStateChanged(user => {
        clearWatch();
        currentUser = user;
        state = clone(demoState);
        if (user) {
          let code = localStorage.getItem(`tether-space:${user.uid}`);
          if (!code) {
            try {
              const previous = JSON.parse(localStorage.getItem(STORE_OLD) || 'null');
              if (previous?.syncMode === 'live' && previous?.coupleCode) code = previous.coupleCode;
            } catch { /* ignore legacy storage */ }
          }
          if (code) watch(code);
          else render();
        } else render();
      }, error => { console.error(error); showToast('Authentication is unavailable'); });
    } catch (error) { firebaseAvailable = false; console.error(error); showToast('Firebase failed to initialize'); }
  }

  setupExtraUI();
  bindEvents();
  render();
  initFirebase();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }

  // Exposed to automated tests only; contains no credentials or user data.
  window.TETHER_UTILS = Object.freeze({
    normalize, localDay, previousDay, escapeHtml, inviteCode, displayMood, streakCount, dateCount
  });
})();
