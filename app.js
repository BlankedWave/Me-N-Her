const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const defaultState = {
  names: { me: 'Alex', partner: 'Jamie' },
  streak: 18,
  moods: {},
  messages: [
    { who: 'partner', text: 'Still thinking about our Sunday walk.', time: '9:42' },
    { who: 'me', text: 'Same. Let’s take the long route again this week.', time: '9:45' },
    { who: 'partner', text: 'Deal. I’ll bring the coffee.', time: '9:46' }
  ],
  moments: [
    { title: 'Rainy-day ramen', date: 'Oct 12', note: 'Found the tiny place with the window seats.', tone: 'peach' },
    { title: 'The coast at dusk', date: 'Sep 28', note: 'Cold hands, loud waves, no rush to leave.', tone: 'ocean' }
  ],
  plans: [
    { title: 'Cook a new recipe', meta: 'Friday · at home', done: false },
    { title: 'Museum late night', meta: 'Oct 26 · 7:00 PM', done: false },
    { title: 'Print our summer photos', meta: 'Someday list', done: true }
  ],
  promptIndex: 0,
  coupleCode: null,
  syncMode: 'demo'
};

let state = loadState();
let currentView = 'home';
let firebaseBridge = null;

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem('tether-state')) }; }
  catch { return structuredClone(defaultState); }
}
function saveState() {
  localStorage.setItem('tether-state', JSON.stringify(state));
  if (firebaseBridge) firebaseBridge.push(state);
}

const prompts = [
  'What small thing made you feel loved this week?',
  'Where would you go if tomorrow were completely free?',
  'What is one ordinary moment with me you never want to forget?',
  'What could I take off your plate this week?',
  'Which version of us makes you smile the most?'
];

function todayKey() { return new Date().toISOString().slice(0, 10); }
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function navigate(view) {
  currentView = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $$('.bottom-nav [data-go]').forEach(el => el.classList.toggle('active', el.dataset.go === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  const date = new Date();
  $('#todayLabel').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date).toUpperCase();
  $('#streakCount').textContent = state.streak;
  $$('.mood-options button').forEach(button => button.classList.toggle('selected', state.moods[todayKey()] === button.dataset.mood));
  $('.status-dot').style.background = state.moods[todayKey()] ? '#74856d' : '#cbbdb2';
  $('#dailyPrompt').textContent = `“${prompts[state.promptIndex % prompts.length]}”`;
  renderMessages(); renderMoments(); renderPlans(); renderSync();
}

function renderMessages() {
  $('#messageList').innerHTML = state.messages.map(message => `
    <div class="message ${message.who}"><p>${escapeHtml(message.text)}</p><time>${escapeHtml(message.time)}</time></div>
  `).join('');
}
function renderMoments() {
  $('#memoryCount').textContent = `${state.moments.length} ${state.moments.length === 1 ? 'memory' : 'memories'}`;
  $('#memoryGrid').innerHTML = state.moments.map(item => `
    <article class="memory-card ${item.tone || 'gold'}"><small>${escapeHtml(item.date).toUpperCase()}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note)}</p></article>
  `).join('');
}
function renderPlans(filter = $('.plan-filter .active')?.dataset.filter || 'all') {
  const plans = state.plans.filter(plan => filter === 'all' || (filter === 'done' ? plan.done : !plan.done));
  $('#plansList').innerHTML = plans.map((plan, index) => {
    const sourceIndex = state.plans.indexOf(plan);
    return `<article class="plan-row ${plan.done ? 'done' : ''}"><button class="plan-check" data-plan-index="${sourceIndex}" aria-label="Mark plan ${plan.done ? 'not done' : 'done'}"></button><div><h3>${escapeHtml(plan.title)}</h3><p>${escapeHtml(plan.meta)}</p></div><span>›</span></article>`;
  }).join('') || '<p class="privacy-note">Nothing in this list yet.</p>';
}
function renderSync() {
  const codeBox = $('#inviteCode');
  if (state.coupleCode) { codeBox.hidden = false; $('strong', codeBox).textContent = state.coupleCode; }
  else codeBox.hidden = true;
  if (state.syncMode === 'live') {
    $('#syncBadge').textContent = 'LIVE'; $('#syncBadge').classList.add('live');
    $('#syncTitle').textContent = 'Your phones are connected';
    $('#syncDescription').textContent = 'Updates are securely shared with your partner through Firebase.';
  }
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function bindCoreEvents() {
  $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  $$('[data-open]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.open}`).showModal()));
  $$('.mood-options button').forEach(button => button.addEventListener('click', () => {
    state.moods[todayKey()] = button.dataset.mood; saveState(); render(); showToast('Check-in saved for today');
  }));
  $('#shufflePrompt').addEventListener('click', () => { state.promptIndex = (state.promptIndex + 1) % prompts.length; saveState(); render(); });
  $('#answerPrompt').addEventListener('click', () => { navigate('chat'); $('#chatInput').value = `My answer: `; $('#chatInput').focus(); });
  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault(); const input = $('#chatInput'); const text = input.value.trim(); if (!text) return;
    state.messages.push({ who: 'me', text, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
    input.value = ''; saveState(); renderMessages(); setTimeout(() => $('#messageList').lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 0);
  });
}

function bindContentEvents() {
  $('#saveMemory').addEventListener('click', event => {
    event.preventDefault(); const form = $('#memoryForm'); if (!form.reportValidity()) return;
    const data = new FormData(form);
    state.moments.unshift({ title: data.get('title'), note: data.get('note') || 'A moment we wanted to keep.', date: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }), tone: ['peach','ocean','gold'][state.moments.length % 3] });
    saveState(); renderMoments(); $('#memoryModal').close(); form.reset(); showToast('Moment added to your archive');
  });
  $('#savePlan').addEventListener('click', event => {
    event.preventDefault(); const form = $('#planForm'); if (!form.reportValidity()) return;
    const data = new FormData(form);
    state.plans.unshift({ title: data.get('title'), meta: data.get('meta') || 'Someday list', done: false });
    saveState(); renderPlans(); $('#planModal').close(); form.reset(); showToast('Plan added');
  });
  $('#plansList').addEventListener('click', event => {
    const button = event.target.closest('[data-plan-index]'); if (!button) return;
    const plan = state.plans[Number(button.dataset.planIndex)]; plan.done = !plan.done; saveState(); renderPlans();
  });
  $$('.plan-filter button').forEach(button => button.addEventListener('click', () => {
    $$('.plan-filter button').forEach(item => item.classList.toggle('active', item === button)); renderPlans(button.dataset.filter);
  }));
  $('#copyCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.coupleCode); showToast('Private code copied'); }
    catch { showToast(`Your code is ${state.coupleCode}`); }
  });
  $('#resetDemo').addEventListener('click', () => {
    if (!confirm('Reset messages, moments, plans, and check-ins?')) return;
    state = structuredClone(defaultState); saveState(); render(); navigate('home'); showToast('Demo reset');
  });
}

let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
$('#installButton').addEventListener('click', async () => {
  if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; }
  else showToast('Use your browser menu and choose “Add to Home Screen”');
});

async function initializeFirebase() {
  const config = window.TETHER_FIREBASE_CONFIG;
  if (!config || typeof firebase === 'undefined') {
    bindDemoConnection(); return;
  }
  try {
    firebase.initializeApp(config);
    const auth = firebase.auth(); const db = firebase.firestore(); const provider = new firebase.auth.GoogleAuthProvider();
    firebaseBridge = createFirebaseBridge(auth, db, provider);
    $('#googleSignIn').addEventListener('click', () => firebaseBridge.signIn());
    $('#createSpace').addEventListener('click', () => firebaseBridge.createSpace());
    $('#joinSpace').addEventListener('click', () => firebaseBridge.joinSpace());
    auth.onAuthStateChanged(user => { if (user) { showToast(`Signed in as ${user.displayName || 'you'}`); if (state.coupleCode) firebaseBridge.watch(state.coupleCode); } });
  } catch (error) { console.error(error); bindDemoConnection(); showToast('Firebase config needs attention'); }
}

function bindDemoConnection() {
  $('#googleSignIn').addEventListener('click', () => showToast('Add your Firebase config to enable Google sign-in'));
  $('#createSpace').addEventListener('click', () => {
    state.coupleCode = makeCode(); saveState(); renderSync(); showToast('Demo code created — add Firebase for real sync');
  });
  $('#joinSpace').addEventListener('click', () => {
    const code = prompt('Enter your six-character couple code'); if (!code) return;
    state.coupleCode = code.trim().toUpperCase(); saveState(); renderSync(); showToast('Demo code saved on this phone');
  });
}
function makeCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

function createFirebaseBridge(auth, db, provider) {
  let unsubscribe = null; let pushTimer = null; let applyingRemote = false;
  const requireUser = async () => auth.currentUser || (await auth.signInWithPopup(provider)).user;
  const watch = code => {
    unsubscribe?.();
    unsubscribe = db.collection('couples').doc(code).onSnapshot(snapshot => {
      if (!snapshot.exists || !snapshot.data().state) return;
      applyingRemote = true;
      state = { ...defaultState, ...snapshot.data().state, coupleCode: code, syncMode: 'live' };
      localStorage.setItem('tether-state', JSON.stringify(state)); render();
      applyingRemote = false;
    }, error => { console.error(error); showToast('Could not open that shared space'); });
  };
  return {
    signIn: () => auth.signInWithPopup(provider),
    async createSpace() {
      const user = await requireUser(); const code = makeCode();
      state.coupleCode = code; state.syncMode = 'live';
      await db.collection('couples').doc(code).set({ memberIds: [user.uid], state: { ...state }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      saveState(); render(); watch(code); showToast('Shared space created — send the code to your partner');
    },
    async joinSpace() {
      const user = await requireUser(); const code = prompt('Enter your six-character couple code'); if (!code) return;
      const normalized = code.trim().toUpperCase();
      try {
        await db.collection('couples').doc(normalized).update({ memberIds: firebase.firestore.FieldValue.arrayUnion(user.uid) });
        state.coupleCode = normalized; state.syncMode = 'live'; saveState(); watch(normalized); showToast('You are connected');
      } catch (error) { console.error(error); showToast('That code could not be joined'); }
    },
    watch,
    push(nextState) {
      if (applyingRemote || !auth.currentUser || !nextState.coupleCode || nextState.syncMode !== 'live') return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => db.collection('couples').doc(nextState.coupleCode).update({ state: { ...nextState }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(console.error), 350);
    }
  };
}

bindCoreEvents();
bindContentEvents();
render();
initializeFirebase();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(console.error);
