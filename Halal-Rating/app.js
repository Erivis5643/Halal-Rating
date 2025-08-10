// Basic SPA router + Supabase wiring (to be configured via config.js)
(() => {
  const screens = Array.from(document.querySelectorAll('.screen'));
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const adminFab = document.getElementById('admin-fab');
  const adminModal = document.getElementById('admin-modal');
  const adminClose = document.getElementById('admin-close');
  // Admin inputs
  const pastNameEl = document.getElementById('past-name');
  const pastTrophiesEl = document.getElementById('past-trophies');
  const pastUsersChipsEl = document.getElementById('past-users-chips');
  const pastPhotosFilesEl = document.getElementById('past-photos-files');
  const futureNameEl = document.getElementById('future-name');
  const futureDescEl = document.getElementById('future-desc');
  const futureDateEl = document.getElementById('future-date');
  const futureTrophiesEl = document.getElementById('future-trophies');
  const awardUsersChipsEl = document.getElementById('award-users-chips');
  const awardSelectEl = document.getElementById('award-select');
  const awardListEl = document.getElementById('award-list');
  // Participant selector modal
  const participantModal = document.getElementById('participant-modal');
  const participantSearchEl = document.getElementById('participant-search');
  const participantResultsEl = document.getElementById('participant-results');
  const participantConfirmEl = document.getElementById('participant-confirm');
  const participantCancelEl = document.getElementById('participant-cancel');

  // Auth modal elements
  const authModal = document.getElementById('auth-modal');
  const emailEl = document.getElementById('auth-email');
  const passwordEl = document.getElementById('auth-password');
  const btnLogin = document.getElementById('auth-login');
  const btnRegister = document.getElementById('auth-register');

  // Profile elements
  const profileUsernameEl = document.getElementById('profile-username');
  const avatarEl = document.getElementById('profile-avatar');
  const btnChangeUsername = document.getElementById('btn-change-username');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnLogout = document.getElementById('btn-logout');
  const btnUploadAvatar = document.getElementById('btn-upload-avatar');
  const avatarFileEl = document.getElementById('avatar-file');

  // Home elements
  const rankNameEl = document.getElementById('rank-name');
  const trophyCountEl = document.getElementById('trophy-count');
  const rankProgressEl = document.getElementById('rank-progress');
  const awardsListEl = document.getElementById('awards-list');
  const userEventsListEl = document.getElementById('user-events-list');
  const rankEmblemEl = document.getElementById('rank-emblem');

  // Leaderboard, Search, Events
  const leaderboardListEl = document.getElementById('leaderboard-list');
  const searchInputEl = document.getElementById('search-input');
  const searchResultsEl = document.getElementById('search-results');
  const futureEventsListEl = document.getElementById('future-events-list');

  // Supabase client placeholder, config expected in global window.SUPABASE_CONFIG
  let supabaseClient = null;
  function ensureSupabase() {
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
      console.warn('No Supabase config found. Create config.js from config.example.js');
      return null;
    }
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    }
    return supabaseClient;
  }

  // Routing
  const showScreen = (targetId) => {
    screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('active');
  };

  navButtons.forEach(btn => {
    if (btn.dataset.default !== undefined) {
      showScreen(btn.dataset.target);
    }
    btn.addEventListener('click', () => showScreen(btn.dataset.target));
  });

  // Admin modal handling
  document.getElementById('btn-create-past').addEventListener('click', async () => {
    if (!client) return alert('Supabase nicht konfiguriert.');
    const name = pastNameEl.value.trim();
    const trophies = parseInt(pastTrophiesEl.value || '0', 10);
    const userIds = getSelectedUserIds('past');
    const photos = await uploadSelectedPhotos();
    if (!name || userIds.length === 0) return alert('Name und mindestens ein Teilnehmer erforderlich.');
    const { data: eventId, error: e1 } = await client.rpc('admin_create_event', { p_kind: 'past', p_name: name, p_description: null, p_event_date: null, p_trophy_amount: trophies });
    if (e1) return alert(e1.message);
    for (const uid of userIds) {
      const { error: e2 } = await client.rpc('admin_add_event_participant', { p_event: eventId, p_user: uid, p_trophies: trophies, p_photos: photos });
      if (e2) return alert(e2.message);
    }
    alert('Passiertes Ereignis erstellt.');
    adminModal.classList.add('hidden');
  });

  document.getElementById('btn-create-future').addEventListener('click', async () => {
    if (!client) return alert('Supabase nicht konfiguriert.');
    const name = futureNameEl.value.trim();
    const desc = futureDescEl.value.trim() || null;
    const date = futureDateEl.value || null;
    const trophies = parseInt(futureTrophiesEl.value || '0', 10);
    if (!name || !date) return alert('Name und Datum sind erforderlich.');
    const { error } = await client.rpc('admin_create_event', { p_kind: 'future', p_name: name, p_description: desc, p_event_date: date, p_trophy_amount: trophies });
    if (error) return alert(error.message);
    alert('Zukünftiges Ereignis erstellt.');
    adminModal.classList.add('hidden');
  });

  document.getElementById('btn-give-award').addEventListener('click', async () => {
    if (!client) return alert('Supabase nicht konfiguriert.');
    const awardId = awardSelectEl.value;
    const userIds = getSelectedUserIds('award');
    if (userIds.length === 0 || !awardId) return alert('Empfänger und Award ID sind erforderlich.');
    for (const uid of userIds) {
      const { error } = await client.rpc('admin_grant_award', { p_award: awardId, p_user: uid });
      if (error) return alert(error.message);
    }
    alert('Auszeichnung(en) vergeben.');
    adminModal.classList.add('hidden');
  });

  async function loadAwardsIntoUI(){
    if (!client || !awardSelectEl) return;
    const { data, error } = await client.from('awards').select('id, name, emoji').order('name');
    if (error) return;
    awardSelectEl.innerHTML = '<option value="">Bitte auswählen...</option>';
    (data || []).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = `${a.emoji || '🏅'} ${a.name}`;
      awardSelectEl.appendChild(opt);
    });
  }
  adminClose.addEventListener('click', () => adminModal.classList.add('hidden'));
  adminFab.addEventListener('click', async () => { await loadAwardsIntoUI(); adminModal.classList.remove('hidden'); });

  // Theme toggle (auto -> dark -> light)
  const THEMES = ['auto','dark','light'];
  function getTheme(){ return localStorage.getItem('theme') || 'auto'; }
  function applyTheme(theme){
    document.documentElement.dataset.theme = theme;
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }
  applyTheme(getTheme());
  function updateThemeLabel(){ btnThemeToggle.textContent = `Theme (${getTheme()})`; }
  btnThemeToggle.addEventListener('click', () => {
    const current = getTheme();
    const next = THEMES[(THEMES.indexOf(current)+1)%THEMES.length];
    applyTheme(next);
    updateThemeLabel();
  });
  updateThemeLabel();

  // Auth flow
  const client = ensureSupabase();
  async function refreshSession() {
    if (!client) {
      authModal.classList.remove('hidden');
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data.session) {
      authModal.classList.remove('hidden');
    } else {
      authModal.classList.add('hidden');
      await onLogin(data.session.user);
    }
  }

  btnLogin.addEventListener('click', async () => {
    if (!client) return alert('Supabase nicht konfiguriert.');
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) return alert('Bitte E-Mail und Passwort eingeben.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    await refreshSession();
  });

  btnRegister.addEventListener('click', async () => {
    if (!client) return alert('Supabase nicht konfiguriert.');
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) return alert('Bitte E-Mail und Passwort eingeben.');
    const { error } = await client.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert('Registrierung erfolgreich. Bitte E-Mail bestätigen und dann einloggen.');
  });

  btnLogout.addEventListener('click', async () => {
    if (!client) return;
    await client.auth.signOut();
    location.reload();
  });

  // After login
  async function onLogin(user){
    await ensureProfileExists(user);
    const profile = await fetchOwnProfile();
    const username = profile?.username || user.email?.split('@')[0] || user.id.slice(0,6);
    profileUsernameEl.textContent = username;
    avatarEl.src = profile?.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.id)}`;

    // Render with live data
    await renderHome(profile);
    await renderLeaderboard();
    await renderFutureEvents();

    // Show + button if admin role
    const isAdmin = profile?.role === 'admin' || await checkIsAdmin(user.id);
    adminFab.classList.toggle('hidden', !isAdmin);
  }

  async function checkIsAdmin(userId){
    if (!client) return false;
    try{
      const { data, error } = await client.from('profiles').select('role').eq('id', userId).single();
      if (error) return false;
      return data?.role === 'admin';
    }catch{ return false; }
  }

  async function ensureProfileExists(user){
    if (!client) return;
    // Try to fetch
    const { data, error } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (error) return;
    if (!data) {
      const username = user.email?.split('@')[0] || `user_${user.id.slice(0,6)}`;
      await client.from('profiles').insert({ id: user.id, username }).select();
    }
  }

  async function fetchOwnProfile(){
    const { data: userData } = await client.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return null;
    const { data } = await client.from('profiles').select('*').eq('id', userId).single();
    return data || null;
  }

  function computeRank(total){
    const ranks = [
      { name: 'Unrankt', min: 0, next: 100 },
      { name: 'Front Flipper', min: 100, next: 200 },
      { name: 'Flicker Massen Beta', min: 200, next: 300 },
      { name: 'Haram-Schlachter', min: 300, next: 400 },
      { name: 'Pockai Knose', min: 400, next: 500 },
      { name: 'Fnaf/Tuf', min: 500, next: 600 },
      { name: 'Schwertmensch', min: 600, next: 700 },
      { name: 'Bake Flips Flippa', min: 700, next: 800 },
      { name: 'Käse Füß Sigma', min: 800, next: 900 },
      { name: 'Ultimate Durchhähmer', min: 1000, next: 1200 },
      { name: 'Creeper/Stripper', min: 1200, next: 1400 },
      { name: 'Psychiatrie C1', min: 1400, next: 1450 },
      { name: 'Psychiatrie C2', min: 1450, next: 1500 },
      { name: 'Psychiatrie C3', min: 1500, next: 1550 },
      { name: 'Psychiatrie C4', min: 1550, next: 1600 },
      { name: 'Halal-Schlachter', min: 1600, next: null },
    ];
    let current = ranks[0];
    for (const r of ranks) {
      if (total >= r.min) current = r; else break;
    }
    const nextAt = current.next;
    const progress = nextAt ? Math.max(0, Math.min(100, ((total - current.min) / (nextAt - current.min)) * 100)) : 100;
    const remaining = nextAt ? Math.max(0, nextAt - total) : 0;
    return { name: current.name, progress, nextAt, remaining };
  }

  // Map rank names to emblem file paths under ./fotos/
  function resolveRankEmblem(rankName){
    const map = {
      'Unrankt': 'unrankt.png',
      'Front Flipper': 'front-flipper.png',
      'Flicker Massen Beta': 'flicker-massen-beta.png',
      'Haram-Schlachter': 'haram-schlachter.png',
      'Pockai Knose': 'pockai-knose.png',
      'Fnaf/Tuf': 'fnaf-tuf.png',
      'Schwertmensch': 'schwertmensch.png',
      'Bake Flips Flippa': 'bake-flips-flippa.png',
      'Käse Füß Sigma': 'kaese-fuss-sigma.png',
      'Ultimate Durchhähmer': 'ultimate-durchhaehmer.png',
      'Creeper/Stripper': 'creeper-stripper.png',
      'Psychiatrie C1': 'psychiatrie-c1.png',
      'Psychiatrie C2': 'psychiatrie-c2.png',
      'Psychiatrie C3': 'psychiatrie-c3.png',
      'Psychiatrie C4': 'psychiatrie-c4.png',
      'Halal-Schlachter': 'halal-schlachter.png'
    };
    const file = map[rankName] || 'unrankt.png';
    return `./fotos/${file}`;
  }

  function attachRankEmblem(imgEl, rankName){
    if (!imgEl) return;
    let triedJpg = false;
    imgEl.onerror = () => {
      if (!triedJpg && imgEl.src.endsWith('.png')) {
        triedJpg = true;
        imgEl.src = imgEl.src.replace('.png', '.jpg');
      } else {
        imgEl.src = './fotos/unrankt.png';
      }
    };
    imgEl.src = resolveRankEmblem(rankName);
  }

  async function renderHome(profile){
    const total = profile?.total_trophies || 0;
    const info = computeRank(total);
    trophyCountEl.textContent = String(total);
    rankNameEl.textContent = info.name;
    attachRankEmblem(rankEmblemEl, info.name);
    rankProgressEl.style.width = `${info.progress}%`;
    document.getElementById('rank-remaining').textContent = info.nextAt ? `${info.remaining} bis ${info.nextAt}` : 'Max Rank';
    document.getElementById('rank-percent').textContent = `${Math.round(info.progress)}%`;

    // Load my awards and my events here (Home only)
    const { data: userData } = await client.auth.getUser();
    const userId = userData?.user?.id;
    if (userId) {
      const { data: awards } = await client.from('user_awards').select('award_id, awards(name, emoji)').eq('user_id', userId).order('created_at', { ascending: false });
      awardsListEl.innerHTML = '';
      (awards||[]).forEach(a => {
        const el = document.createElement('div');
        el.className = 'item';
        el.textContent = `${a.awards?.emoji || '🏅'} ${a.awards?.name || ''}`;
        awardsListEl.appendChild(el);
      });
      if (!awards || awards.length === 0) awardsListEl.innerHTML = '<div class="item">Noch keine Auszeichnungen</div>';

      const { data: evs } = await client
        .from('event_participants')
        .select('trophies_awarded, photos, events(name, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userEventsListEl.innerHTML = '';
      (evs||[]).forEach(ep => {
        const el = document.createElement('div');
        el.className = 'item';
        const photos = (ep.photos||[]).map(u => `<img src="${u}" alt="photo" style="height:48px;border-radius:8px;margin-right:6px"/>`).join('');
        el.innerHTML = `<strong>${ep.events?.name||''}</strong> — 🏆 ${ep.trophies_awarded}<div class="row">${photos}</div>`;
        userEventsListEl.appendChild(el);
      });
      if (!evs || evs.length === 0) userEventsListEl.innerHTML = '<div class="item">Noch keine Ereignisse</div>';
    }
  }

  // Demo renderers (placeholder content until DB is connected)
  // (demo renderer removed; replaced by renderHome)

  async function renderLeaderboard(){
    if (!client) return;
    const { data, error } = await client.from('profiles').select('id, username, total_trophies, avatar_url').order('total_trophies', { ascending: false }).limit(50);
    if (error) return;
    leaderboardListEl.innerHTML = '';
    (data || []).forEach((r, idx) => {
      const el = document.createElement('div');
      el.className = 'item user';
      const avatar = r.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(r.username||String(idx))}`;
      el.innerHTML = `<img src="${avatar}" alt="avatar"/><div><div><strong>#${idx+1}</strong> @${r.username || 'user'}</div><div>${r.total_trophies||0} 🏆</div></div>`;
      el.addEventListener('click', () => showPublicProfile(r));
      if (idx < 3) el.style.background = '#332b00';
      leaderboardListEl.appendChild(el);
    });
  }

  async function renderFutureEvents(){
    if (!client) return;
    const { data, error } = await client.from('events').select('id, name, description, event_date, trophy_amount').eq('kind', 'future').order('event_date', { ascending: true });
    if (error) return;
    if (!data || data.length === 0) {
      futureEventsListEl.innerHTML = '<div class="item">Keine zukünftigen Ereignisse</div>';
      return;
    }
    futureEventsListEl.innerHTML = '';
    data.forEach(ev => {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<strong>${ev.name}</strong> — ${ev.description||''}<br/>📅 ${ev.event_date||''} • 🏆 ${ev.trophy_amount||0}`;
      futureEventsListEl.appendChild(el);
    });
  }

  // Username change
  btnChangeUsername.addEventListener('click', async () => {
    const newName = prompt('Neuer Benutzername:');
    if (!newName) return;
    if (!client) return alert('Supabase nicht konfiguriert.');
    const { data: userData } = await client.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    const { error } = await client.from('profiles').upsert({ id: userId, username: newName }).select();
    if (error) return alert(error.message);
    profileUsernameEl.textContent = newName;
  });

  // Search
  searchInputEl?.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    searchResultsEl.innerHTML = '';
    if (!q || !client) return;
    const { data, error } = await client.from('profiles').select('id, username, total_trophies, avatar_url').ilike('username', `%${q}%`).limit(20);
    if (error) return;
    data.forEach(row => {
      const el = document.createElement('div');
      el.className = 'item user';
      const avatar = row.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(row.id)}`;
      el.innerHTML = `<img src="${avatar}" alt="avatar"/><div><div><strong>@${row.username || 'user'}</strong></div><div>${row.total_trophies||0} 🏆</div></div>`;
      el.addEventListener('click', () => showPublicProfile(row));
      searchResultsEl.appendChild(el);
    });
  });

  function showPublicProfile(user){
    window.PUBLIC_PROFILE_VIEW = { id: user.id, username: user.username, total_trophies: user.total_trophies };
    showScreen('public-profile');
    renderPublicProfile(user.id);
  }

  // Participant selection and helpers
  let participantSelectionContext = null; // 'past' | 'award'
  const btnSelectPast = document.getElementById('btn-select-past-users');
  const btnSelectAward = document.getElementById('btn-select-award-users');
  btnSelectPast?.addEventListener('click', () => openParticipantSelector('past'));
  btnSelectAward?.addEventListener('click', () => openParticipantSelector('award'));
  participantCancelEl?.addEventListener('click', () => participantModal.classList.add('hidden'));
  participantConfirmEl?.addEventListener('click', () => {
    const selected = Array.from(participantResultsEl.querySelectorAll('input[type="checkbox"]:checked')).map(c => ({ id: c.value, username: c.dataset.username }));
    applySelectedUsers(selected, participantSelectionContext);
    participantModal.classList.add('hidden');
  });
  participantSearchEl?.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    if (!client) return;
    const { data, error } = await client.from('profiles').select('id, username, total_trophies').ilike('username', `%${q}%`).limit(30);
    if (error) return;
    renderParticipantResults(data || []);
  }, 300));

  function openParticipantSelector(context){
    participantSelectionContext = context;
    participantResultsEl.innerHTML = '';
    participantSearchEl.value = '';
    participantModal.classList.remove('hidden');
  }
  function renderParticipantResults(rows){
    participantResultsEl.innerHTML = '';
    rows.forEach(r => {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<label class="row space"><span>@${r.username || 'user'} — ${r.total_trophies||0} 🏆</span><input type="checkbox" value="${r.id}" data-username="${r.username||'user'}" /></label>`;
      participantResultsEl.appendChild(el);
    });
  }
  function applySelectedUsers(list, context){
    const container = context === 'past' ? pastUsersChipsEl : awardUsersChipsEl;
    container.innerHTML = '';
    list.forEach(u => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `@${u.username}`;
      chip.dataset.userId = u.id;
      container.appendChild(chip);
    });
  }
  function getSelectedUserIds(context){
    const container = context === 'past' ? pastUsersChipsEl : awardUsersChipsEl;
    return Array.from(container.querySelectorAll('.chip')).map(c => c.dataset.userId).filter(Boolean);
  }

  // Photo upload to storage bucket 'event-photos'
  async function uploadSelectedPhotos(){
    if (!client) return [];
    const files = Array.from(pastPhotosFilesEl?.files || []);
    if (files.length === 0) return [];
    const urls = [];
    for (const file of files) {
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
      const { error } = await client.storage.from('event-photos').upload(path, file, { upsert: false });
      if (error) { alert(error.message); continue; }
      const { data } = client.storage.from('event-photos').getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  }

  // Public profile DOM and renderer
  const publicUsernameEl = document.getElementById('public-username');
  const publicAvatarEl = document.getElementById('public-avatar');
  const publicTrophiesEl = document.getElementById('public-trophy-count');
  const publicRankNameEl = document.getElementById('public-rank-name');
  const publicRankProgressEl = document.getElementById('public-rank-progress');
  const publicAwardsEl = document.getElementById('public-awards');
  const publicEventsEl = document.getElementById('public-events');
  const publicRankEmblemEl = document.getElementById('public-rank-emblem');
  document.getElementById('btn-public-back')?.addEventListener('click', () => showScreen('search'));
  const previewModal = document.getElementById('preview-modal');
  const previewImage = document.getElementById('preview-image');
  const previewClose = document.getElementById('preview-close');
  previewClose?.addEventListener('click', () => previewModal.classList.add('hidden'));

  async function renderPublicProfile(userId){
    const { data: profile } = await client.from('profiles').select('*').eq('id', userId).single();
    publicUsernameEl.textContent = `@${profile?.username || 'user'}`;
    publicAvatarEl.src = profile?.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(userId)}`;
    const total = profile?.total_trophies || 0;
    publicTrophiesEl.textContent = String(total);
    const info = computeRank(total);
    publicRankNameEl.textContent = info.name;
    attachRankEmblem(publicRankEmblemEl, info.name);
    publicRankProgressEl.style.width = `${info.progress}%`;
    document.getElementById('public-rank-remaining').textContent = info.nextAt ? `${info.remaining} bis ${info.nextAt}` : 'Max Rank';
    document.getElementById('public-rank-percent').textContent = `${Math.round(info.progress)}%`;

    const { data: awards } = await client.from('user_awards').select('award_id, awards(id, name, emoji)').eq('user_id', userId).order('created_at', { ascending: false });
    publicAwardsEl.innerHTML = '';
    const isAdmin = await isAdminCurrentUser();
    (awards||[]).forEach(a => {
      const el = document.createElement('div');
      el.className = 'item';
      if (isAdmin) {
        const btn = document.createElement('button');
        btn.className = 'secondary';
        btn.textContent = 'Entfernen';
        btn.addEventListener('click', async () => {
          await client.rpc('admin_remove_user_award', { p_user: userId, p_award: a.awards?.id });
          await renderPublicProfile(userId);
        });
        el.textContent = `${a.awards?.emoji || '🏅'} ${a.awards?.name || ''} `;
        el.appendChild(btn);
      } else {
        el.textContent = `${a.awards?.emoji || '🏅'} ${a.awards?.name || ''}`;
      }
      publicAwardsEl.appendChild(el);
    });
    if (!awards || awards.length === 0) publicAwardsEl.innerHTML = '<div class="item">Keine Auszeichnungen</div>';

    const { data: evs } = await client
      .from('event_participants')
      .select('id, trophies_awarded, photos, events(name, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    publicEventsEl.innerHTML = '';
    (evs||[]).forEach(ep => {
      const el = document.createElement('div');
      el.className = 'item';
      const photos = (ep.photos||[]).map(u => `<img src="${u}" alt="photo" class="photo-thumb" data-full="${u}"/>`).join('');
      el.innerHTML = `<strong>${ep.events?.name||''}</strong> — 🏆 ${ep.trophies_awarded}<div class="row">${photos}</div>`;
      if (isAdmin) {
        const btn = document.createElement('button');
        btn.className = 'danger';
        btn.textContent = 'Teilnahme entfernen';
        btn.addEventListener('click', async () => {
          await client.rpc('admin_remove_event_participation', { p_participation_id: ep.id });
          await renderPublicProfile(userId);
        });
        el.appendChild(btn);
      }
      publicEventsEl.appendChild(el);
      el.querySelectorAll('.photo-thumb').forEach(img => {
        img.addEventListener('click', (e) => {
          const full = e.currentTarget.getAttribute('data-full');
          previewImage.src = full;
          previewModal.classList.remove('hidden');
        });
      });
    });
    if (!evs || evs.length === 0) publicEventsEl.innerHTML = '<div class="item">Keine Ereignisse</div>';
  }

  // Avatar upload & usage
  btnUploadAvatar?.addEventListener('click', () => avatarFileEl?.click());
  avatarFileEl?.addEventListener('change', async () => {
    if (!client) return;
    const file = avatarFileEl.files?.[0];
    if (!file) return;
    const { data: ud } = await client.auth.getUser();
    const uid = ud?.user?.id;
    if (!uid) return;
    const path = `${uid}/${Date.now()}_${file.name}`;
    const { error } = await client.storage.from('avatars').upload(path, file, { upsert: false });
    if (error) return alert(error.message);
    const { data } = client.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = data?.publicUrl;
    if (!avatarUrl) return;
    const { error: e2 } = await client.from('profiles').update({ avatar_url: avatarUrl }).eq('id', uid);
    if (e2) return alert(e2.message);
    avatarEl.src = avatarUrl;
    alert('Profilfoto aktualisiert.');
  });

  function debounce(fn, ms){ let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  async function isAdminCurrentUser(){
    const { data } = await client.auth.getUser();
    const uid = data?.user?.id; if (!uid) return false;
    const { data: prof } = await client.from('profiles').select('role').eq('id', uid).single();
    return prof?.role === 'admin';
  }

  // Init
  refreshSession();
})();


