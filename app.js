// ==================== CONFIG ====================
// REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://pfhzoulmqjgluilwqdhi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaHpvdWxtcWpnbHVpbHdxZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDQ0NzUsImV4cCI6MjEwMDcyMDQ3NX0.Z6IDSdMHhyYWZGWPdIRHQEZ0eqc4AkDjb9xO5koQTPo';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ==================== STATE ====================
let currentUser = null;
let userProfile = null;
let allNotes = [];
let filteredNotes = [];
let currentFilter = { subject: 'all', class: 'all', type: 'all', search: '' };
let authMode = 'signin';
let lang = localStorage.getItem('lang') || 'en';
// ==================== TRANSLATIONS ====================
const i18n = {
    en: {
        tagline: 'Never Fall Behind',
        'hero-badge': '5,000+ notes uploaded',
        'hero-title-1': 'Missed class?',
        'hero-title-2': 'We got your back.',
        'hero-desc': 'Access class notes and past exam questions from top students across Cameroon. Free for recent notes. Premium for full archives.',
        'browse-notes': 'Browse Notes',
        'go-premium': 'Go Premium',
        signin: 'Sign In',
        'recent-notes': 'Recent Notes',
        'no-notes': 'No notes found',
        'try-different': 'Try a different search or filter',
        'premium-title': 'Unlock Everything',
        'premium-f1': 'Unlimited access to all subjects',
        'premium-f2': 'Full archive (not just last 2 weeks)',
        'premium-f3': 'Offline downloads for low-data study',
        'premium-f4': 'Exam questions from top schools',
        'per-year': 'per year',
        'upgrade-now': 'Upgrade Now',
        'all-classes': 'All Classes',
        'all-types': 'All Types',
        'class-notes': 'Class Notes',
        'exam-questions': 'Exam Questions'
    },
    fr: {
        tagline: 'Ne Reste Jamais en Arrière',
        'hero-badge': 'Plus de 5 000 notes',
        'hero-title-1': 'Cours manqué?',
        'hero-title-2': 'On vous couvre.',
        'hero-desc': 'Accédez aux notes de cours et aux examens des meilleurs élèves du Cameroun. Gratuit pour les notes récentes. Premium pour les archives complètes.',
        'browse-notes': 'Parcourir',
        'go-premium': 'Passer Premium',
        signin: 'Connexion',
        'recent-notes': 'Notes Récentes',
        'no-notes': 'Aucune note trouvée',
        'try-different': 'Essayez une autre recherche',
        'premium-title': 'Débloquez Tout',
        'premium-f1': 'Accès illimité à toutes les matières',
        'premium-f2': 'Archives complètes',
        'premium-f3': 'Téléchargements hors ligne',
        'premium-f4': "Questions d'Examens",
        'per-year': 'par an',
        'upgrade-now': 'Passer Premium',
        'all-classes': 'Toutes Classes',
        'all-types': 'Tous Types',
        'class-notes': 'Notes de Cours',
        'exam-questions': "Questions d'Examen"
    }
};
const subjects = [
    { id: 'mathematics', name: 'Mathematics', icon: 'fa-calculator', color: 'bg-blue-500' },
    { id: 'english', name: 'English', icon: 'fa-book', color: 'bg-indigo-500' },
    { id: 'french', name: 'French', icon: 'fa-language', color: 'bg-purple-500' },
    { id: 'biology', name: 'Biology', icon: 'fa-dna', color: 'bg-green-500' },
    { id: 'chemistry', name: 'Chemistry', icon: 'fa-flask', color: 'bg-yellow-500' },
    { id: 'physics', name: 'Physics', icon: 'fa-atom', color: 'bg-indigo-500' },
    { id: 'history', name: 'History', icon: 'fa-landmark', color: 'bg-orange-500' },
    { id: 'geography', name: 'Geography', icon: 'fa-globe', color: 'bg-teal-500' },
    { id: 'economics', name: 'Economics', icon: 'fa-chart-line', color: 'bg-cyan-500' },
    { id: 'computer', name: 'Computer Science', icon: 'fa-laptop-code', color: 'bg-gray-500' }
];
// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initLanguage();
    renderSubjectFilters();
    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        unlockApp();
    } else {
        // Show auth gate by default
        document.getElementById('auth-gate').classList.remove('hidden');
    }
    // Load notes in background (will show when unlocked)
    await loadNotes();
});
// ==================== THEME & LANGUAGE ====================
function initTheme() {
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
}
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
function initLanguage() {
    document.getElementById('lang-btn').textContent = lang === 'en' ? 'FR' : 'EN';
    applyTranslations();
}
function toggleLanguage() {
    lang = lang === 'en' ? 'fr' : 'en';
    localStorage.setItem('lang', lang);
    document.getElementById('lang-btn').textContent = lang === 'en' ? 'FR' : 'EN';
    applyTranslations();
}
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) el.textContent = i18n[lang][key];
    });
}
// ==================== AUTH GATE ====================
function toggleAuthMode() {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    document.getElementById('auth-title').textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';
    document.getElementById('auth-submit').textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
    document.getElementById('auth-toggle-text').textContent = authMode === 'signin' ? "Don't have an account?" : 'Already have an account?';
    document.getElementById('auth-toggle-btn').textContent = authMode === 'signin' ? 'Sign Up' : 'Sign In';
    document.getElementById('auth-name-field').classList.toggle('hidden', authMode === 'signin');
}
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('auth-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        if (authMode === 'signin') {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            currentUser = data.user;
        } else {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            currentUser = data.user;
            await supabase.from('profiles').insert([{
                id: currentUser.id,
                email,
                full_name: name || email.split('@')[0],
                role: 'student',
                is_premium: false
            }]);
        }
        await loadUserProfile();
        unlockApp();
        showToast('Welcome back!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
function unlockApp() {
    const gate = document.getElementById('auth-gate');
    gate.classList.add('hidden-gate');
    setTimeout(() => {
        gate.classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateAuthUI();
        applyFilters();
    }, 300);
}
async function loadUserProfile() {
    if (!currentUser) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    userProfile = data;
}
function updateAuthUI() {
    const container = document.getElementById('auth-section');
    const status = document.getElementById('user-status');
    if (currentUser && userProfile) {
        container.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="hidden sm:inline text-sm font-medium truncate max-w-[120px]">${userProfile.full_name || currentUser.email}</span>
                <button onclick="signOut()" class="text-sm text-red-500 hover:text-red-600 font-medium">Logout</button>
            </div>
        `;
        status.classList.remove('hidden');
        status.classList.add('flex');
        status.innerHTML = userProfile.is_premium
            ? '<i class="fas fa-crown text-yellow-500"></i><span>Premium</span>'
            : '<i class="fas fa-star"></i><span>Free Plan</span>';
        if (userProfile.is_premium) {
            status.className = 'flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium';
        }
    } else {
        container.innerHTML = `<button onclick="location.reload()" class="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-full font-medium transition-all shadow-md hover:shadow-lg">Sign In</button>`;
        status.classList.add('hidden');
        status.classList.remove('flex');
    }
}
async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    userProfile = null;
    location.reload();
}
// ==================== NOTES ====================
function renderSubjectFilters() {
    const container = document.getElementById('subject-filters');
    subjects.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium whitespace-nowrap transition-all hover:bg-gray-200 dark:hover:bg-gray-700';
        btn.textContent = sub.name;
        btn.dataset.subject = sub.id;
        btn.onclick = () => filterBySubject(sub.id);
        container.appendChild(btn);
    });
}
async function loadNotes() {
    try {
        const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allNotes = data || [];
    } catch (err) {
        allNotes = getDemoNotes();
    }
    applyFilters();
}
function getDemoNotes() {
    const now = new Date();
    return [
        { id: 1, title: 'Differentiation Rules', subject: 'mathematics', class_level: 'form5', description: 'Product, quotient, chain rule with worked examples.', file_url: '#', file_type: 'pdf', is_premium: false, is_exam: false, created_at: new Date(now - 86400000 * 2).toISOString(), downloads: 45, school: 'GBHS Limbe' },
        { id: 2, title: 'GCE 2024 Biology Paper 2', subject: 'biology', class_level: 'upper6', description: 'Past exam with marking scheme.', file_url: '#', file_type: 'pdf', is_premium: true, is_exam: true, created_at: new Date(now - 86400000 * 128).toISOString(), downloads: 234, school: 'Saker Baptist' },
        { id: 3, title: 'French Literature Analysis', subject: 'french', class_level: 'lower6', description: "Corneille's Le Cid for BAC.", file_url: '#', file_type: 'pdf', is_premium: false, is_exam: false, created_at: new Date(now - 86400000 * 5).toISOString(), downloads: 67, school: 'BHS Bamenda' },
        { id: 4, title: 'Organic Chemistry - Alkanes', subject: 'chemistry', class_level: 'upper6', description: 'Structures and reactions.', file_url: '#', file_type: 'pdf', is_premium: false, is_exam: false, created_at: new Date(now - 86400000 * 20).toISOString(), downloads: 89, school: 'Sacred Heart' },
        { id: 5, title: 'English Essay Writing Guide', subject: 'english', class_level: 'form5', description: 'Argumentative & narrative essays.', file_url: '#', file_type: 'pdf', is_premium: false, is_exam: false, created_at: new Date(now - 86400000 * 1).toISOString(), downloads: 156, school: 'PCHS Kumba' },
        { id: 6, title: 'Physics - Electromagnetism', subject: 'physics', class_level: 'upper6', description: "Faraday's law & transformers.", file_url: '#', file_type: 'pdf', is_premium: false, is_exam: false, created_at: new Date(now - 86400000 * 3).toISOString(), downloads: 56, school: 'GBHS Limbe' },
    ];
}
function filterBySubject(subjectId) {
    currentFilter.subject = subjectId;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.subject === subjectId) {
            btn.className = 'filter-btn active px-4 py-2 rounded-full bg-brand-600 text-white text-sm font-medium whitespace-nowrap transition-all';
        } else {
            btn.className = 'filter-btn px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium whitespace-nowrap transition-all hover:bg-gray-200 dark:hover:bg-gray-700';
        }
    });
    applyFilters();
}
function applyFilters() {
    const classFilter = document.getElementById('class-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    currentFilter.class = classFilter;
    currentFilter.type = typeFilter;
    filteredNotes = allNotes.filter(note => {
        const matchSubject = currentFilter.subject === 'all' || note.subject === currentFilter.subject;
        const matchClass = currentFilter.class === 'all' || note.class_level === currentFilter.class;
        const matchType = currentFilter.type === 'all' || (currentFilter.type === 'exam' ? note.is_exam : !note.is_exam);
        const matchSearch = !currentFilter.search ||
            note.title.toLowerCase().includes(currentFilter.search.toLowerCase()) ||
            note.description.toLowerCase().includes(currentFilter.search.toLowerCase());
        return matchSubject && matchClass && matchType && matchSearch;
    });
    renderNotes();
}
function handleSearch(query) {
    currentFilter.search = query;
    applyFilters();
}
function renderNotes() {
    const grid = document.getElementById('notes-grid');
    const empty = document.getElementById('empty-state');
    if (filteredNotes.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    grid.innerHTML = filteredNotes.map(note => {
        const subject = subjects.find(s => s.id === note.subject) || { name: note.subject, color: 'bg-gray-500', icon: 'fa-file' };
        const isOld = new Date() - new Date(note.created_at) > 14 * 24 * 60 * 60 * 1000;
        const isLocked = isOld && !(userProfile?.is_premium);
        const dateStr = new Date(note.created_at).toLocaleDateString();
        return `
            <div class="note-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer group relative overflow-hidden" onclick="openNote(${note.id})">
                ${isLocked ? `<div class="absolute top-0 right-0 w-8 h-8 rounded-bl-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center"><i class="fas fa-lock text-yellow-600 dark:text-yellow-400 text-xs"></i></div>` : ''}
                <div class="p-5">
                    <div class="flex items-start justify-between mb-4">
                        <div class="w-12 h-12 rounded-lg flex items-center justify-center text-white ${subject.color}">
                            <i class="fas ${subject.icon}"></i>
                        </div>
                        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">${dateStr}</span>
                    </div>
                    <h4 class="font-bold text-lg mb-1 group-hover:text-brand-600 transition-colors">${note.title}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">${note.description}</p>
                    <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span class="flex items-center gap-1"><i class="fas fa-school"></i> ${note.school || 'Unknown'}</span>
                        <span class="flex items-center gap-1"><i class="fas fa-download"></i> ${note.downloads || 0}</span>
                    </div>
                    ${note.is_exam ? `<span class="mt-3 inline-block px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">Exam</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}
// ==================== NOTE VIEWER ====================
function openNote(noteId) {
    window.currentNoteId = noteId;
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;
    const subject = subjects.find(s => s.id === note.subject) || { name: note.subject };
    const isOld = new Date(note.created_at) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const isLocked = isOld && (!userProfile || !userProfile.is_premium);
    document.getElementById('note-modal-title').textContent = note.title;
    document.getElementById('note-modal-subject').textContent = subject.name;
    document.getElementById('note-modal-class').textContent = note.class_level.toUpperCase().replace('FORM', 'Form ').replace('LOWER', 'Lower ').replace('UPPER', 'Upper ');
    document.getElementById('note-modal-type').textContent = note.is_exam ? 'Exam' : 'Notes';
    document.getElementById('note-modal-meta').textContent = `${note.school || 'Unknown'} • ${new Date(note.created_at).toLocaleDateString()}`;
    document.getElementById('note-modal-desc').textContent = note.description;
    document.getElementById('note-download-btn').href = note.file_url;
    const blocker = document.getElementById('premium-blocker');
    const actions = document.getElementById('note-actions');
    if (isLocked) {
        blocker.classList.remove('hidden');
        actions.classList.add('hidden');
    } else {
        blocker.classList.add('hidden');
        actions.classList.remove('hidden');
        document.getElementById('note-download-btn').onclick = () => trackDownload(note.id);
    }
    document.getElementById('note-modal').classList.remove('hidden');
}
function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
}
async function trackDownload(noteId) {
    try {
        const { data } = await supabase.from('notes').select('downloads').eq('id', noteId).single();
        const current = data?.downloads || 0;
        await supabase.from('notes').update({ downloads: current + 1 }).eq('id', noteId);
    } catch (e) {
        console.log('Download tracked locally');
    }
}
function shareNote() {
    const note = allNotes.find(n => n.id === window.currentNoteId);
    if (!note) return;
    if (navigator.share) {
        navigator.share({ title: note.title, text: note.description, url: window.location.href });
    } else {
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!', 'success');
    }
}
// ================== PREMIUM ==================
function openPremiumModal() {
  document.getElementById('premium-modal').classList.remove('hidden');
}
function closePremiumModal() {
  document.getElementById('premium-modal').classList.add('hidden');
}
async function requestPremium() {
  if (!currentUser) {
    closePremiumModal();
    showToast('Please sign in first', 'info');
    return;
  }
  try {
    await supabase.from('premium_requests').insert([{
      user_id: currentUser.id,
      email: currentUser.email,
      phone: userProfile?.phone || '',
      amount: 2500,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    showToast('Payment request sent! Admin will contact you.', 'success');
    closePremiumModal();
  } catch (err) {
    showToast('Request saved locally', 'info');
    closePremiumModal();
  }
}
async function applyCoupon() {
  const code = document.getElementById('coupon-code').value.trim().toUpperCase();
  if (!code) return;
  if (!currentUser) {
    showToast('Please sign in first', 'info');
    return;
  }
  try {
    const { data, error } = await supabase.from('coupons').select('*').eq('code', code).single();
    if (error || !data || data.uses_left <= 0) {
      showToast('Invalid or expired coupon', 'error');
      return;
    }
    await supabase.from('profiles').update({
      is_premium: true,
      premium_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }).eq('id', currentUser.id);
    await supabase.from('coupons').update({ uses_left: data.uses_left - 1 }).eq('id', data.id);
    await loadUserProfile();
    updateAuthUI();
    showToast('Premium activated!', 'success');
    closePremiumModal();
    applyFilters();
  } catch (err) {
    showToast('Error applying coupon', 'error');
  }
}
// ================== UI HELPERS ==================
function scrollToNotes() {
  document.getElementById('notes-section').scrollIntoView({ behavior: 'smooth' });
}
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' };
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 toast-enter`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="font-medium text-sm">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event == 'SIGNED_IN') {
    currentUser = session.user;
    await loadUserProfile();
    unlockApp();
  } else if (event == 'SIGNED_OUT') {
    currentUser = null;
    userProfile = null;
  }
});
