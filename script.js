const SUPABASE_URL = 'https://lvypldbozwzzzbicgddd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eXBsZGJvend6enpiaWNnZGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjQxOTYsImV4cCI6MjEwMDkwMDE5Nn0.arSebpJ6HAPIbNwSoyGkMuBuy4wlh9ZOwsUUsdesLv8';

// Graceful fallback if Supabase library fails to load
let supabaseClient = null;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  location.reload();
}

let notes = [];
let currentUser = null;
let currentOpenNoteId = null;
function recentKey(){ return 'sp_recent_' + ((currentUser && currentUser.id) || 'guest'); }
function savedKey(){ return 'sp_saved_' + ((currentUser && currentUser.id) || 'guest'); }
function visitKey(){ return 'sp_visit_' + ((currentUser && currentUser.id) || 'guest'); }
function getLastVisit(){ return parseInt(localStorage.getItem(visitKey()) || '0'); }
function setLastVisit(){ localStorage.setItem(visitKey(), Date.now().toString()); }
function isNewNote(createdAt){ return new Date(createdAt).getTime() > getLastVisit(); }
function getRecent(){ return JSON.parse(localStorage.getItem(recentKey()) || '[]'); }
function setRecent(v){ localStorage.setItem(recentKey(), JSON.stringify(v)); }
function getSaved(){ return JSON.parse(localStorage.getItem(savedKey()) || '[]'); }
function setSaved(v){ localStorage.setItem(savedKey(), JSON.stringify(v)); }

/* Generate default avatar with initials */
function getAvatarUrl(name, size=128){
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const colors = ['#4f46e5','#7c3aed','#2563eb','#db2777','#059669','#d97706','#dc2626','#0891b2'];
  const hue = name.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
  const bg = colors[hue % colors.length];
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,size,size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size*0.4}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = (name || 'U').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  ctx.fillText(initials, size/2, size/2);
  return canvas.toDataURL('image/png');
}

function switchAuthTab(mode){
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===mode));
  document.querySelectorAll('.auth-form').forEach(f=>f.classList.toggle('active', f.id===mode));
}
function showAuthForm(mode){
  switchAuthTab(mode);
}
function showForgotPassword(e){
  e.preventDefault();
  document.querySelectorAll('.auth-form').forEach(f=>f.classList.remove('active'));
  document.getElementById('forgot').classList.add('active');
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
}

function setInputStatus(input, iconEl, hintEl, isValid, msg){
  input.classList.remove('valid','invalid');
  iconEl.classList.remove('show');
  if(hintEl) hintEl.textContent = '';
  if(msg === '') return;
  input.classList.add(isValid ? 'valid' : 'invalid');
  iconEl.textContent = isValid ? '✅' : '❌';
  iconEl.classList.add('show');
  if(hintEl){
    hintEl.textContent = msg;
    hintEl.className = 'input-hint ' + (isValid ? 'valid' : 'invalid');
  }
}

function validateSigninEmail(){
  const el = document.getElementById('signinEmail');
  const icon = document.getElementById('signinEmailIcon');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  setInputStatus(el, icon, null, valid, '');
}

function validateSignupEmail(){
  const el = document.getElementById('signupEmail');
  const icon = document.getElementById('signupEmailIcon');
  const hint = document.getElementById('signupEmailHint');
  if(!el.value){ setInputStatus(el,icon,hint,false,''); return; }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  setInputStatus(el,icon,hint,valid, valid ? 'Looks good' : 'Enter a valid email address');
  checkSignupReady();
}

function validateSignupPassword(){
  const el = document.getElementById('signupPassword');
  const icon = document.getElementById('signupPassIcon');
  const hint = document.getElementById('signupPassHint');
  if(!el.value){ setInputStatus(el,icon,hint,false,''); return; }
  const v = el.value;
  let s = 0;
  if(v.length>=8) s++;
  if(/[A-Z]/.test(v)) s++;
  if(/[0-9]/.test(v)) s++;
  if(/[^A-Za-z0-9]/.test(v)) s++;
  const labels = ['Too weak','Weak','Good','Strong'];
  const isValid = s >= 2 && v.length >= 8;
  setInputStatus(el,icon,hint,isValid, isValid ? `Strength: ${labels[s-1]||'Weak'}` : 'Min 8 chars with uppercase, number, or symbol');
  validateSignupMatch();
  checkSignupReady();
}

function validateSignupMatch(){
  const p = document.getElementById('signupPassword').value;
  const el = document.getElementById('signupConfirm');
  const icon = document.getElementById('signupMatchIcon');
  const hint = document.getElementById('signupMatchHint');
  if(!el.value){ setInputStatus(el,icon,hint,false,''); return; }
  const valid = el.value === p && p !== '';
  setInputStatus(el,icon,hint,valid, valid ? 'Passwords match' : 'Passwords do not match');
  checkSignupReady();
}

function checkSignupReady(){
  const emailOK = document.getElementById('signupEmail').classList.contains('valid');
  const passOK = document.getElementById('signupPassword').classList.contains('valid');
  const matchOK = document.getElementById('signupConfirm').classList.contains('valid');
  const nameOK = document.getElementById('signupName').value.trim().length > 0;
  document.getElementById('signupBtn').disabled = !(emailOK && passOK && matchOK && nameOK);
}

async function handleForgotPassword(e){
  e.preventDefault();
  if(!supabaseClient){ showToast('Service unavailable. Please try again later.', 'danger'); return; }
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if(error){ showToast(error.message, 'danger'); return; }
  showToast(t('resetEmailSent') || 'Check your email for reset instructions');
  showAuthForm('signin');
}

async function handleResetPassword(e){
  e.preventDefault();
  if(!supabaseClient){ showToast('Service unavailable. Please try again later.', 'danger'); return; }
  const pass = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetConfirm').value;
  if(pass !== confirm){ showToast(t('passwordsMatch') || 'Passwords do not match', 'danger'); return; }
  if(pass.length < 8){ showToast(t('passwordMin') || 'Password must be at least 8 characters', 'danger'); return; }
  const { error } = await supabaseClient.auth.updateUser({ password: pass });
  if(error){ showToast(error.message, 'danger'); return; }
  showToast(t('passwordUpdated') || 'Password updated! Please sign in.');
  document.getElementById('resetView').style.display='none';
  document.getElementById('authGate').style.display='flex';
  showAuthForm('signin');
}

async function handleSignup(e){
  e.preventDefault();
  if(!supabaseClient){ showToast('Service unavailable. Please try again later.', 'danger'); return; }
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pass = document.getElementById('signupPassword').value;

  const { data, error } = await supabaseClient.auth.signUp({
    email, password: pass,
    options: { data: { name } }
  });
  if(error){ showToast(error.message, 'danger'); return; }

  if(data.user){
    await supabaseClient.from('profiles').insert({
      id: data.user.id, name, role: 'student'
    });
  }

  showToast(t('accountCreated') || 'Account created! Please sign in.');
  switchAuthTab('signin');
  document.getElementById('signinEmail').value = email;
}

async function handleSignin(e){
  e.preventDefault();
  if(!supabaseClient){ showToast('Service unavailable. Please try again later.', 'danger'); return; }
  const email = document.getElementById('signinEmail').value.trim().toLowerCase();
  const pass = document.getElementById('signinPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  if(error){ showToast(error.message, 'danger'); return; }

  currentUser = data.user;
  await loadProfile();
  enterApp();
}

async function logout(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  location.reload();
}

async function loadProfile(){
  if(!currentUser || !supabaseClient) return;
  const { data } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  if(data){
    currentUser.profile = data;
    currentUser.name = data.name || (currentUser.user_metadata && currentUser.user_metadata.name) || '';
  }
}
async function enterApp(){
  document.getElementById('authGate').style.display='none';
  document.getElementById('app').style.display='block';

  await loadNotes();

  const avatarUrl = (currentUser && currentUser.profile && currentUser.profile.avatar) || getAvatarUrl(currentUser.name || 'User');
  document.getElementById('meAvatar').src = avatarUrl;
  document.getElementById('manageAvatar').src = avatarUrl;

  document.getElementById('meName').textContent = currentUser.name || (currentUser.email && currentUser.email.split('@')[0]) || 'User';
  document.getElementById('meEmail').textContent = currentUser.email || '';

  document.getElementById('manageName').value = currentUser.name || '';
  document.getElementById('manageEmail').value = currentUser.email || '';

  const savedPrefs = JSON.parse(localStorage.getItem('kobein_prefs') || '{}');
  if(savedPrefs.lang){ document.getElementById('meLang').value = savedPrefs.lang; currentLang = savedPrefs.lang; }
  if(savedPrefs.dark){
    document.getElementById('meThemeToggle').checked = true;
    document.documentElement.setAttribute('data-theme','dark');
  }

  renderRecent();
  setLastVisit();
  applyTranslation();

  document.getElementById('skeletonGrid').style.display='grid';
  document.getElementById('notesGrid').style.display='none';
  setTimeout(()=>{
    document.getElementById('skeletonGrid').style.display='none';
    document.getElementById('notesGrid').style.display='grid';
    renderNotes(); renderFilters();
  }, 600);
}

async function loadNotes(){
  if(!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){ console.error(error); return; }
  notes = data || [];
}
async function refreshNotes(){
  const grid = document.getElementById('notesGrid');
  const empty = document.getElementById('emptyState');
  if(grid) grid.style.opacity = '0.5';
  await loadNotes();
  renderNotes(); renderFilters(); renderRecent();
  if(grid) grid.style.opacity = '1';
  showToast(t('notesRefreshed'));
}

/* ===================== NOTES ===================== */
let currentFilter = 'all';
let searchDebounce;

function onSearch(){
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(renderNotes, 200);
}

function renderFilters(){
  const subjects = [...new Set(notes.map(n=>n.subject))].sort();
  const c = document.getElementById('subjectFilters');
  let h = `<button class="filter-btn ${currentFilter==='all'?'active':''}" onclick="filterSubject('all')" data-i18n="allSubjects">All Subjects</button>`;
  subjects.forEach(s=>{ h+=`<button class="filter-btn ${currentFilter===s?'active':''}" onclick="filterSubject('${s}')">${s}</button>`; });
  c.innerHTML = h;
}

function filterSubject(s){ currentFilter=s; renderNotes(); renderFilters(); }

function subjectClass(subject){
  const map={'Mathematics':'tag-math','Science':'tag-science','English':'tag-english','History':'tag-history','Geography':'tag-geography','Computer Science':'tag-computer-science','Physics':'tag-physics','Chemistry':'tag-chemistry','Biology':'tag-biology'};
  return map[subject] || 'tag-other';
}

function renderNotes(){
  const q = document.getElementById('searchInput').value.toLowerCase();
  const g = document.getElementById('notesGrid');
  const e = document.getElementById('emptyState');
  let f = notes.filter(n=>{
    const m = n.title.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q);
    return m && (currentFilter==='all' || n.subject===currentFilter);
  }).sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));

  if(f.length===0){ g.style.display='none'; e.style.display='block'; return; }
  g.style.display='grid'; e.style.display='none';
  g.innerHTML = f.map(n=>`
    <div class="note-card" onclick="openNote('${n.id}')" style="position:relative;">
      <span class="note-subject ${subjectClass(n.subject)}">${n.subject}${isNewNote(n.created_at)?'<span class="note-new-dot"></span>':''}</span>
      <div class="note-title">${escapeHtml(n.title)}</div>
      <div class="note-author">
        <img src="${getAvatarUrl(n.author_name||'Teacher', 40)}" alt="">
        <span>${escapeHtml(n.author_name||'Teacher')}</span>
      </div>
      <div class="note-excerpt">${escapeHtml(n.content.substring(0,140))}...</div>
      <div class="note-meta"><span>${fmtDate(n.created_at)}</span><span>${fmtSize(n.size || (n.content && n.content.length) || 0)}</span></div>
    </div>
  `).join('');
}

function renderRecent(){
  const recent = getRecent();
  const strip = document.getElementById('recentStrip');
  if(!recent.length){ strip.style.display='none'; return; }
  strip.style.display='flex';
  const label = document.createElement('span');
  label.style.cssText = 'font-size:13px;color:var(--text-light);font-weight:600;padding:10px 0;flex-shrink:0;';
  label.textContent = 'Recently viewed:';
  strip.innerHTML = '';
  strip.appendChild(label);
  const limit = window.innerWidth <= 640 ? 3 : 5;
  recent.slice(0,limit).forEach(id=>{
    const n = notes.find(x=>x.id===id);
    if(!n) return;
    const chip = document.createElement('div');
    chip.className='recent-chip';
    chip.innerHTML = escapeHtml(n.title);
    chip.onclick = ()=>openNote(n.id);
    strip.appendChild(chip);
  });
}

function addRecent(id){
  let r = getRecent().filter(x=>x!==id);
  r.unshift(id);
  setRecent(r.slice(0,10));
  renderRecent();
}

/* ===================== LOCAL / SAVED ===================== */
function renderSaved(){
  const saved = getSaved();
  const g = document.getElementById('localGrid');
  const e = document.getElementById('localEmpty');
  const savedNotes = notes.filter(n=>saved.includes(n.id)).sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));

  if(savedNotes.length===0){ g.style.display='none'; e.style.display='block'; return; }
  g.style.display='grid'; e.style.display='none';
  g.innerHTML = savedNotes.map(n=>`
    <div class="note-card" onclick="openNote('${n.id}')" style="position:relative;">
      <span class="note-subject ${subjectClass(n.subject)}">${n.subject}${isNewNote(n.created_at)?'<span class="note-new-dot"></span>':''}</span>
      <div class="note-title">${escapeHtml(n.title)}</div>
      <div class="note-author">
        <img src="${getAvatarUrl(n.author_name||'Teacher', 40)}" alt="">
        <span>${escapeHtml(n.author_name||'Teacher')}</span>
      </div>
      <div class="note-excerpt">${escapeHtml(n.content.substring(0,140))}...</div>
      <div class="note-meta"><span>${fmtDate(n.created_at)}</span><span>Saved</span></div>
    </div>
  `).join('');
}

function saveCurrentNote(){
  if(!currentOpenNoteId) return;
  const saved = getSaved();
  if(saved.includes(currentOpenNoteId)){
    showToast(t('alreadySaved'));
    return;
  }
  saved.unshift(currentOpenNoteId);
  setSaved(saved.slice(0,50));
  const saveBtn = document.querySelector('.modal-actions .btn-ghost');
  if(saveBtn){
    saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    saveBtn.title = 'Saved';
    saveBtn.onclick = null;
    saveBtn.style.cursor = 'default';
    saveBtn.style.opacity = '0.7';
    saveBtn.style.transform = 'scale(1.2)';
    setTimeout(()=> saveBtn.style.transform = 'scale(1)', 250);
  }
  showToast(t('noteSaved'));
}

function removeSavedNote(id){
  const saved = getSaved().filter(x=>x!==id);
  setSaved(saved);
  renderSaved();
  showToast('Note removed', 'success', ()=>{
    const current = getSaved();
    if(!current.includes(id)){ current.unshift(id); setSaved(current); renderSaved(); }
  });
}

/* ===================== READER MODAL ===================== */
let focusTrapHandler = null;

function openNote(id){
  currentOpenNoteId = id;
  const n = notes.find(x=>x.id===id);
  if(!n) return;
  addRecent(id);
  document.getElementById('modalTitle').textContent = n.title;
  document.getElementById('modalMeta').textContent = `${n.subject} • ${fmtDate(n.created_at)} • ${n.author_name||'Teacher'}`;
  const body = document.getElementById('modalBody');
  body.textContent = n.content;
  body.scrollTop = 0;
  document.getElementById('readingProgress').style.width='0%';
  const saved = getSaved();
  const saveBtn = document.querySelector('.modal-actions .btn-ghost');
  if(saveBtn){
    if(saved.includes(id)){
      saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      saveBtn.title = 'Saved';
      saveBtn.onclick = null;
      saveBtn.style.cursor = 'default';
      saveBtn.style.opacity = '0.7';
    } else {
      saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      saveBtn.title = 'Save offline';
      saveBtn.onclick = ()=>saveCurrentNote();
      saveBtn.style.cursor = 'pointer';
      saveBtn.style.opacity = '1';
    }
  }
  const overlay = document.getElementById('readerModal');
  overlay.classList.add('active');
  document.body.style.overflow='hidden';
  var _bn=document.querySelector('.bottom-nav');if(_bn)_bn.classList.add('hidden');

  setTimeout(()=>{
    const modal = document.getElementById('readerModalBox');
    const focusables = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    if(focusables.length) focusables[0].focus();
    focusTrapHandler = (e)=>{
      if(e.key!=='Tab') return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){ last.focus(); e.preventDefault(); }
      else if(!e.shiftKey && document.activeElement===last){ first.focus(); e.preventDefault(); }
    };
    modal.addEventListener('keydown', focusTrapHandler);

    const body = document.getElementById('modalBody');
    body.onscroll = ()=>{
      const pct = body.scrollTop / (body.scrollHeight - body.clientHeight);
      document.getElementById('readingProgress').style.width = Math.min(100, pct*100)+'%';
    };
  }, 50);

  initSwipeToClose();
}

function closeModal(){
  const overlay = document.getElementById('readerModal');
  const modal = document.getElementById('readerModalBox');
  overlay.classList.remove('active');
  modal.style.transform = '';
  document.body.style.overflow='';
  if(focusTrapHandler) modal.removeEventListener('keydown', focusTrapHandler);
  document.getElementById('modalBody').onscroll = null;
  currentOpenNoteId = null;
  setTimeout(()=> {var _bn2=document.querySelector('.bottom-nav');if(_bn2)_bn2.classList.remove('hidden');}, 100);
}

function onBackdropClick(e){ if(e.target===e.currentTarget) closeModal(); }

let touchStartY = 0;
let isDraggingHeader = false;
function initSwipeToClose(){
  const modal = document.getElementById('readerModalBox');
  const header = modal.querySelector('.modal-header');
  const handle = modal.querySelector('.sheet-handle');
  const dragTargets = [header, handle].filter(Boolean);

  dragTargets.forEach(target => {
    target.ontouchstart = e => {
      touchStartY = e.touches[0].clientY;
      isDraggingHeader = true;
      modal.style.transition = 'none';
    };
    target.ontouchmove = e => {
      if(!isDraggingHeader || window.innerWidth > 640) return;
      const diff = e.touches[0].clientY - touchStartY;
      if(diff > 0) modal.style.transform = `translateY(${diff}px)`;
    };
    target.ontouchend = e => {
      if(!isDraggingHeader || window.innerWidth > 640) return;
      isDraggingHeader = false;
      modal.style.transition = '';
      const diff = e.changedTouches[0].clientY - touchStartY;
      if(diff > 100){ closeModal(); }
      else { modal.style.transform = ''; }
    };
    target.ontouchcancel = () => {
      isDraggingHeader = false;
      modal.style.transition = '';
      modal.style.transform = '';
    };
  });

  // Body scrolls freely — do not attach swipe handlers here
  const body = document.getElementById('modalBody');
  body.ontouchstart = null;
  body.ontouchmove = null;
  body.ontouchend = null;
}
/* ===================== APP NAV ===================== */
function showAppView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(t=>t.classList.remove('active'));
  if(view !== 'manage'){
    document.getElementById('view-'+view).classList.add('active');
    document.getElementById('bnav-'+view).classList.add('active');
  } else {
    document.getElementById('view-manage').classList.add('active');
    document.getElementById('bnav-me').classList.add('active');
  }
  if(view==='notes'){ renderRecent(); renderNotes(); renderFilters(); }
  if(view==='local'){ renderSaved(); }
}

function showManageAccount(){
  showAppView('manage');
}

/* ===================== MANAGE ACCOUNT ===================== */
async function previewAvatar(input){
  if(!supabaseClient){ showToast('Service unavailable. Please try again later.', 'danger'); return; }
  if(input.files && input.files[0]){
    const file = input.files[0];
    const filePath = `avatars/${currentUser.id}/${Date.now()}_${file.name}`;

    const { error: upErr } = await supabaseClient.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
    if(upErr){ showToast(upErr.message, 'danger'); return; }

    const { data: { publicUrl } } = supabaseClient.storage
      .from('avatars')
      .getPublicUrl(filePath);

    document.getElementById('manageAvatar').src = publicUrl;
    document.getElementById('meAvatar').src = publicUrl;

    const { error } = await supabaseClient
      .from('profiles')
      .update({ avatar: publicUrl })
      .eq('id', currentUser.id);
    if(error){ showToast(error.message, 'danger'); return; }

    currentUser.profile = currentUser.profile || {};
    currentUser.profile.avatar = publicUrl;
    showToast(t('photoUpdated'));
  }
}

async function saveManageAccount(){
  if(!currentUser || !supabaseClient) return;
  const name = document.getElementById('manageName').value.trim();
  if(!name){ showToast(t('nameRequired'),'danger'); return; }

  const { error } = await supabaseClient
    .from('profiles')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', currentUser.id);
  if(error){ showToast(error.message, 'danger'); return; }

  currentUser.name = name;
  document.getElementById('meName').textContent = name;

  const newAvatar = (currentUser.profile && currentUser.profile.avatar) || getAvatarUrl(name);
  document.getElementById('meAvatar').src = newAvatar;

  showToast(t('accountUpdated'));
  showAppView('me');
}

/* ===================== ME / SETTINGS ===================== */
function saveMeLang(){
  const lang = document.getElementById('meLang').value;
  currentLang = lang;
  const prefs = JSON.parse(localStorage.getItem('kobein_prefs') || '{}');
  prefs.lang = lang;
  localStorage.setItem('kobein_prefs', JSON.stringify(prefs));
  applyTranslation();
  renderNotes(); renderSaved(); renderFilters();
  showToast(t('languageSaved'));
}

function toggleTheme(){
  const d = document.getElementById('meThemeToggle').checked;
  document.documentElement.setAttribute('data-theme', d?'dark':'light');
  const prefs = JSON.parse(localStorage.getItem('kobein_prefs') || '{}');
  prefs.dark = d;
  localStorage.setItem('kobein_prefs', JSON.stringify(prefs));
}

/* ===================== TOAST ===================== */
let toastUndoFn = null;
function showToast(msg, type='success', undoFn=null){
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  const u = document.getElementById('toastUndo');
  const p = document.getElementById('toastProgress');
  m.textContent = msg;
  t.style.background = type==='danger' ? 'var(--danger)' : 'var(--text)';
  toastUndoFn = undoFn;
  if(undoFn){
    u.style.display = 'inline-block';
    u.onclick = ()=>{ undoFn(); hideToast(); };
  } else {
    u.style.display = 'none';
  }
  p.style.animation = 'none';
  p.offsetHeight;
  p.style.animation = 'progress 5s linear forwards';
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(hideToast, 2500);
}

function hideToast(){
  document.getElementById('toast').classList.remove('show');
}

/* ===================== I18N ===================== */
const i18n = {
  en:{
    notes:'Notes',savedNotes:'Saved Notes',home:'Home',local:'Local',me:'Me',
    accountCreated:'Account created! Please sign in.',
    manageAccount:'Manage Account',privacy:'Privacy',suggestions:'Suggestions',
    aboutUs:'About Us',language:'Language',darkMode:'Dark Mode',
    subscribePremium:'Subscribe to Premium',premiumDesc:'Unlock unlimited downloads <span data-i18n="and">and</span> offline access',
    recentlyViewed:'Recently viewed:',allSubjects:'All Subjects',
    searchPlaceholder:'Search notes by title or subject...',
    noNotes:'No notes available yet',noNotesDesc:"Your teacher hasn't uploaded any class notes. Check back later!",
    noSaved:'No saved notes',noSavedDesc:'Open any note <span data-i18n="and">and</span> tap Save to download it for offline reading.',
    saved:'Saved',refresh:'Refresh',browseNotes:'Browse Notes',
    welcomeBack:'Welcome back',signInPortal:'Sign in to access your portal',
    createAccount:'Create account',getStarted:'Get started with Kobein',
    fullName:'Full Name',email:'Email',password:'Password',confirmPassword:'Confirm Password',
    rememberMe:'Remember me',forgotPassword:'Forgot your password?',
    signIn:'Sign In',createAccountBtn:'Create Account',
    terms:'<span data-i18n="terms">By signing up, you agree to our</span>',termsLink:'Terms',and:'and',privacyLink:'Privacy Policy',
    logout:'Logout',saveChanges:'Save Changes',back:'Back',changePhoto:'Change Photo',
    noteSaved:'Note saved offline',alreadySaved:'Already saved',copied:'Copied to clipboard',
    copyFailed:'Copy failed',accountUpdated:'Account updated',photoUpdated:'Photo updated',
    nameRequired:'Name is required',languageSaved:'Language saved',
    notesRefreshed:'Notes refreshed',offline:'You are offline',
    premiumSoon:'Premium coming soon!',privacySoon:'Privacy settings coming soon!',
    suggestionsSoon:'Suggestions coming soon!',aboutSoon:'About us coming soon!',
    resetPassword:'Reset Password',resetDesc:'Enter your email and we will send you a reset link.',
    sendResetLink:'Send Reset Link',backToSignIn:'Back to Sign In',
    resetEmailSent:'Check your email for reset instructions',
    newPassword:'New Password',newPasswordDesc:'Enter your new password below.',
    updatePassword:'Update Password',passwordsMatch:'Passwords do not match',
    passwordMin:'Password must be at least 8 characters',passwordUpdated:'Password updated! Please sign in.'
  },
  fr:{
    notes:'Notes',savedNotes:'Notes enregistrées',home:'Accueil',local:'Local',me:'Moi',
    accountCreated:'Compte créé ! Veuillez vous connecter.',
    manageAccount:'Gérer le compte',privacy:'Confidentialité',suggestions:'Suggestions',
    aboutUs:'À propos',language:'Langue',darkMode:'Mode sombre',
    subscribePremium:'Passer Premium',premiumDesc:'Téléchargements illimités et accès hors ligne',
    recentlyViewed:'Récemment consultés :',allSubjects:'Toutes matières',
    searchPlaceholder:'Rechercher par titre ou matière...',
    noNotes:'Aucune note disponible',noNotesDesc:"Votre professeur n'a pas encore publié de notes. Revenez plus tard !",
    noSaved:'Aucune note enregistrée',noSavedDesc:'Ouvrez une note et appuyez sur Enregistrer pour la télécharger.',
    saved:'Enregistrée',refresh:'Actualiser',browseNotes:'Parcourir',
    welcomeBack:'Bon retour',signInPortal:'Connectez-vous pour accéder à votre portail',
    createAccount:'Créer un compte',getStarted:'Commencez avec Kobein',
    fullName:'Nom complet',email:'E-mail',password:'Mot de passe',confirmPassword:'Confirmer le mot de passe',
    rememberMe:'Se souvenir de moi',forgotPassword:'Mot de passe oublié ?',
    signIn:'Se connecter',createAccountBtn:'Créer un compte',
    terms:"En vous inscrivant, vous acceptez nos",termsLink:'Conditions',and:'et',privacyLink:'Politique de confidentialité',
    logout:'Déconnexion',saveChanges:'Enregistrer',back:'Retour',changePhoto:'Changer la photo',
    noteSaved:'Note enregistrée hors ligne',alreadySaved:'Déjà enregistrée',copied:'Copié dans le presse-papiers',
    copyFailed:'Échec de la copie',accountUpdated:'Compte mis à jour',photoUpdated:'Photo mise à jour',
    nameRequired:'Le nom est requis',languageSaved:'Langue enregistrée',
    notesRefreshed:'Notes actualisées',offline:'Vous êtes hors ligne',
    premiumSoon:'Premium bientôt disponible !',privacySoon:'Confidentialité bientôt disponible !',
    suggestionsSoon:'Suggestions bientôt disponibles !',aboutSoon:'À propos bientôt disponible !',
    resetPassword:'Réinitialiser le mot de passe',resetDesc:'Entrez votre e-mail et nous vous enverrons un lien de réinitialisation.',
    sendResetLink:'Envoyer le lien',backToSignIn:'Retour à la connexion',
    resetEmailSent:'Vérifiez votre e-mail pour les instructions de réinitialisation',
    newPassword:'Nouveau mot de passe',newPasswordDesc:'Entrez votre nouveau mot de passe ci-dessous.',
    updatePassword:'Mettre à jour',passwordsMatch:'Les mots de passe ne correspondent pas',
    passwordMin:'Le mot de passe doit contenir au moins 8 caractères',passwordUpdated:'Mot de passe mis à jour ! Veuillez vous connecter.'
  }
};

let currentLang = 'en';
function t(key){ return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || key; }

function applyTranslation(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    if((i18n[currentLang] && i18n[currentLang][key])) el.textContent = i18n[currentLang][key];
  });
  // Update placeholders
  const searchInput = document.getElementById('searchInput');
  if(searchInput) searchInput.placeholder = t('searchPlaceholder');
}

/* ===================== UTILS ===================== */
function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function fmtDate(i){ const d=new Date(i); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function fmtSize(b){ if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/(1024*1024)).toFixed(1)+' MB'; }

/* ===================== KEYBOARD SHORTCUTS ===================== */
document.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
  if(e.key==='/' && !e.ctrlKey && !e.metaKey){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    if(s){ s.focus(); s.select(); }
  }
  if(e.key==='Escape') closeModal();
});

/* ===================== OFFLINE ===================== */
function updateOfflineBar(){
  const bar = document.getElementById('offlineBar');
  if(!bar) return;
  if(!navigator.onLine) bar.classList.add('show');
  else bar.classList.remove('show');
}
window.addEventListener('online', updateOfflineBar);
window.addEventListener('offline', updateOfflineBar);

/* ===================== INIT ===================== */
(async function init(){
  updateOfflineBar();

  // Check for password recovery token in URL
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  if(params.get('type') === 'recovery'){
    document.getElementById('authGate').style.display='none';
    document.getElementById('resetView').style.display='flex';
    return;
  }

  if(!supabaseClient){
    // Supabase didn't load — auth gate error overlay already shown in HTML
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session){
    currentUser = session.user;
    await loadProfile();
    enterApp();
  }
})();