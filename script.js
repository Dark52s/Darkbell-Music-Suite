const CLIENT_ID = '444772383538-hodqv1d07h0msms636u69r8rj5tarapo.apps.googleusercontent.com';
const API_KEY = 'AIzaSyApft16O4U7bJKH8tF5EUAGbMeUZzpE_Tc'; // Clave para Drive
const YOUTUBE_API_KEY = 'AIzaSyDLqEkb85BH07E7kLYsKOZtcUN2ztrz324'; // Tu nueva clave para YouTube
const SCOPES = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";
const GENERIC_COVER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='3'/><path d='M12 12l3.5-3.5'/></svg>`;
let accessToken = localStorage.getItem('drive_music_token') || null;
let musicFiles =[], configFileId = null;
let userData = { favorites:[], playlists: {}, customCovers: {}, customMeta: {}, wallpaper: null };

// --- GESTIÓN DE VISTAS Y COLA ---
let currentView = 'library'; // 'library', 'youtube'
let playbackQueue =[];
let currentIndex = -1;
let isShuffle = false;
let repeatMode = 0; 

// --- REPRODUCTORES DUALES ---
const audio = new Audio();
audio.volume = 0.8;

let ytPlayer = null;
let ytProgressInterval = null;

// Referencia al contenedor del player y al elemento iframe real
const ytContainer = document.getElementById('ytplayer-container');
const ytPlayerDiv = document.getElementById('ytplayer');

// Inicialización de API de YouTube
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('ytplayer', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: { 
            'autoplay': 0, 
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1,
            'origin': window.location.origin,
            'playsinline': 1,
            'rel': 0,
            'showinfo': 0
        },
        events: { 
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange 
        }
    });
}

function onPlayerReady(event) {
    // Configurar volumen inicial
    setVolume(audio.volume);
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        handleTrackEnd();
    } else if (event.data === YT.PlayerState.PLAYING) {
        startYtProgress();
        document.getElementById('play_btn').innerHTML = '<span class="material-symbols-outlined">pause</span>';
    } else if (event.data === YT.PlayerState.PAUSED) {
        clearInterval(ytProgressInterval);
        document.getElementById('play_btn').innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    } else {
        clearInterval(ytProgressInterval);
    }
}

function startYtProgress() {
    clearInterval(ytProgressInterval);
    ytProgressInterval = setInterval(() => {
        if(ytPlayer && ytPlayer.getCurrentTime) {
            const ct = ytPlayer.getCurrentTime();
            const dur = ytPlayer.getDuration();
            const p = document.getElementById('prog');
            p.max = dur || 0;
            p.value = ct;
            document.getElementById('time_current').innerText = formatTime(ct);
            document.getElementById('time_total').innerText = formatTime(dur);
        }
    }, 1000);
}

// --- TEMA Y PERSONALIZACIÓN (sin cambios) ---
let currentTheme = localStorage.getItem('drive_music_theme') || 'dark';
let currentAccent = localStorage.getItem('drive_music_accent') || '#1db954';
let currentBlur = localStorage.getItem('drive_music_blur') || '12'; 

function initTheme() {
    setTheme(currentTheme);
    setAccent(currentAccent);
    updateBlur(currentBlur, false);
}
initTheme();

function updateBlur(val, save = true) {
    currentBlur = val;
    document.documentElement.style.setProperty('--glass-blur', `${val}px`);
    const display = document.getElementById('blur_val_display');
    if (display) display.innerText = `${val}px`;
    if (save) localStorage.setItem('drive_music_blur', val);
}

function setTheme(mode) {
    currentTheme = mode;
    localStorage.setItem('drive_music_theme', mode);
    if (mode === 'light') { document.body.classList.add('light-mode'); } 
    else { document.body.classList.remove('light-mode'); }
    
    const darkBtn = document.getElementById('btn_dark_mode');
    const lightBtn = document.getElementById('btn_light_mode');
    if (darkBtn) darkBtn.classList.toggle('active', mode === 'dark');
    if (lightBtn) lightBtn.classList.toggle('active', mode === 'light');
}

function setAccent(color, element = null) {
    currentAccent = color;
    localStorage.setItem('drive_music_accent', color);
    document.documentElement.style.setProperty('--accent', color);

    document.querySelectorAll('.theme-swatch').forEach(sw => sw.classList.remove('active'));
    if (element) { element.classList.add('active'); } 
    else {
        const swatch = document.querySelector(`.theme-swatch[data-color="${color}"]`);
        if (swatch) swatch.classList.add('active');
    }
}

function openThemeModal() {
    const modal = document.getElementById('theme_modal');
    document.getElementById('btn_dark_mode').classList.toggle('active', currentTheme === 'dark');
    document.getElementById('btn_light_mode').classList.toggle('active', currentTheme === 'light');
    
    document.querySelectorAll('.theme-swatch').forEach(sw => {
        sw.classList.remove('active');
        if (sw.getAttribute('data-color') === currentAccent) { sw.classList.add('active'); }
    });

    document.getElementById('wallpaper_file_input').value = "";
    const blurContainer = document.getElementById('blur_control_container');

    if (userData.wallpaper) {
        document.getElementById('wallpaper_preview').src = userData.wallpaper;
        document.getElementById('wallpaper_preview').style.display = 'block';
        document.getElementById('wallpaper_upload_placeholder').style.display = 'none';
        if (blurContainer) blurContainer.style.display = 'block';
    } else {
        document.getElementById('wallpaper_preview').src = "";
        document.getElementById('wallpaper_preview').style.display = 'none';
        document.getElementById('wallpaper_upload_placeholder').style.display = 'block';
        if (blurContainer) blurContainer.style.display = 'none';
    }

    const blurSlider = document.getElementById('blur_slider');
    if (blurSlider) {
        blurSlider.value = currentBlur;
        document.getElementById('blur_val_display').innerText = `${currentBlur}px`;
    }

    showModal(modal);
    document.getElementById('profile_dropdown').classList.remove('show');
}

// --- FONDO DE PANTALLA (sin cambios) ---
function handleWallpaperUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 1920; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            userData.wallpaper = canvas.toDataURL('image/webp', 0.6); 
            applyWallpaper();
            await syncToDrive();
            notify("Fondo de pantalla guardado", "wallpaper");
            
            document.getElementById('wallpaper_preview').src = userData.wallpaper;
            document.getElementById('wallpaper_preview').style.display = 'block';
            document.getElementById('wallpaper_upload_placeholder').style.display = 'none';
            document.getElementById('blur_control_container').style.display = 'block';
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

async function removeWallpaper() {
    userData.wallpaper = null;
    applyWallpaper();
    await syncToDrive();
    notify("Fondo eliminado", "wallpaper");
    
    document.getElementById('wallpaper_preview').src = "";
    document.getElementById('wallpaper_preview').style.display = 'none';
    document.getElementById('wallpaper_upload_placeholder').style.display = 'block';
    document.getElementById('wallpaper_file_input').value = "";
    document.getElementById('blur_control_container').style.display = 'none';
}

function applyWallpaper() {
    const wpEl = document.getElementById('app_wallpaper');
    if (userData.wallpaper) {
        wpEl.style.backgroundImage = `url(${userData.wallpaper})`;
        document.body.classList.add('has-wallpaper');
    } else {
        wpEl.style.backgroundImage = 'none';
        document.body.classList.remove('has-wallpaper');
    }
}

// --- AUTH (sin cambios) ---
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES,
        callback: (resp) => { 
            accessToken = resp.access_token; 
            localStorage.setItem('drive_music_token', accessToken); 
            initApp(); 
        },
    });
    if(accessToken) initApp();
}

async function initApp() {
    try {
        const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
        if(!userResp.ok) throw new Error('Token expirado');
        const data = await userResp.json();
        
        document.getElementById('auth_btn').style.display = 'none';
        document.getElementById('user_profile').style.display = 'flex';
        document.getElementById('user_name').innerText = data.given_name || data.name;
        document.getElementById('user_photo').src = data.picture;
        
        initCloudStorage();
    } catch(e) { logout(); }
}

function logout() {
    localStorage.removeItem('drive_music_token');
    location.reload();
}

function toggleProfileMenu(e) {
    e.stopPropagation();
    document.getElementById('profile_dropdown').classList.toggle('show');
}

window.addEventListener('click', () => {
    const menu = document.getElementById('profile_dropdown');
    if(menu) menu.classList.remove('show');
});

function handleAuth() { tokenClient.requestAccessToken({ prompt: 'consent' }); }

// --- DRIVE (sin cambios) ---
function notify(text, icon = "cloud_done") {
    const t = document.getElementById('toast');
    document.getElementById('toast_text').innerText = text;
    document.getElementById('toast_icon').innerText = icon;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

async function syncToDrive() {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${configFileId}?uploadType=media`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
}

async function initCloudStorage() {
    const q = encodeURIComponent("name = 'music_config.json' and trashed = false");
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&key=${API_KEY}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();
    if (data.files?.length > 0) {
        configFileId = data.files[0].id;
        const fileResp = await fetch(`https://www.googleapis.com/drive/v3/files/${configFileId}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
        userData = await fileResp.json();
        
        if(!userData.customCovers) userData.customCovers = {};
        if(!userData.customMeta) userData.customMeta = {};
        if(!userData.wallpaper) userData.wallpaper = null;

    } else {
        const metadata = { name: 'music_config.json', mimeType: 'application/json' };
        const createResp = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });
        const newFile = await createResp.json();
        configFileId = newFile.id;
        await syncToDrive();
    }
    applyWallpaper();
    listMusic();
}

async function listMusic() {
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType contains 'audio/'&fields=files(id, name)&key=${API_KEY}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();
    musicFiles = data.files.map(f => ({ ...f, source: 'drive' })); // Identificamos origen
    showLibrary();
    renderPlaylists();
}

function getTrackMeta(id, defaultName) {
    if (userData.customMeta && userData.customMeta[id]) {
        return {
            title: userData.customMeta[id].title || defaultName,
            artist: userData.customMeta[id].artist || "Artista Desconocido"
        };
    }
    return { title: defaultName, artist: "Artista Desconocido" };
}

function render(files) {
    const grid = document.getElementById('music_grid');
    grid.innerHTML = "";
    files.forEach(f => {
        // Lógica dual: Renderiza Drive o YouTube
        const isYT = f.source === 'youtube';
        const defaultName = isYT ? f.name : f.name.replace(/\.[^/.]+$/, "");
        const meta = isYT ? { title: f.name, artist: f.artist } : getTrackMeta(f.id, defaultName);
        
        // No mostramos fav/playlist buttons para YT de momento para mantenerlo simple
        const controlsHTML = isYT ? 
            `<div class="yt-badge">YOUTUBE</div>` : 
            `<button class="icon-btn fav-icon ${userData.favorites.includes(f.id)?'active':''}" onclick="event.stopPropagation(); toggleFav('${f.id}')" style="position:absolute;top:15px;right:15px;z-index:2;"><span class="material-symbols-outlined">favorite</span></button>
             <button class="icon-btn" onclick="event.stopPropagation(); showPlaylistPicker('${f.id}')" style="position:absolute;top:15px;left:15px;z-index:2;background:rgba(0,0,0,0.5);border-radius:50%;padding:2px;"><span class="material-symbols-outlined">playlist_add</span></button>
             <button class="icon-btn" onclick="event.stopPropagation(); openEditTrackModal('${f.id}', '${defaultName.replace(/'/g, "\\'")}')" style="position:absolute;top:15px;left:45px;z-index:2;background:rgba(0,0,0,0.5);border-radius:50%;padding:2px;" title="Editar Canción"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>`;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            ${controlsHTML}
            <img id="img-${f.id}" src="${isYT ? f.cover : GENERIC_COVER}">
            <h3 style="font-size:14px; margin:8px 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${meta.title}">${meta.title}</h3>
            <p style="font-size:11px; margin:0; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${meta.artist}</p>`;
        
        card.onclick = () => playFile(f.id, files);
        grid.appendChild(card);

        if(!isYT) loadCover(f.id, meta.title);
    });
}

// --- BUSCADOR YOUTUBE Y DRIVE (MODIFICADO) ---
let ytSearchTimeout = null;

// Ahora handleSearchInput solo filtra en Drive; no hace nada en YouTube
function handleSearchInput(q) {
    if (currentView !== 'youtube') {
        search(q); // Filtrado local para Drive
    }
    // En YouTube no se hace nada mientras se escribe
}

// Manejador de tecla para el campo de búsqueda
function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        const q = event.target.value.trim();
        if (currentView === 'youtube') {
            if (q === '') {
                document.getElementById('music_grid').innerHTML = '<div style="color:var(--text-muted); width:100%; text-align:center; margin-top:50px;">Escribe para buscar en YouTube</div>';
                return;
            }
            searchYouTube(q);
        } else {
            search(q); // Para Drive, también se puede buscar con Enter
        }
    }
}

function search(q) { 
    const query = q.toLowerCase();
    render(musicFiles.filter(f => {
        const defaultName = f.name.replace(/\.[^/.]+$/, "");
        const meta = getTrackMeta(f.id, defaultName);
        return meta.title.toLowerCase().includes(query) || meta.artist.toLowerCase().includes(query);
    })); 
}

async function searchYouTube(query) {
    document.getElementById('music_grid').innerHTML = '<div style="color:var(--text-muted); width:100%; text-align:center; margin-top:50px;">Buscando en YouTube...</div>';
    try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        const ytFiles = data.items.map(item => ({
            id: item.id.videoId,
            name: item.snippet.title,
            artist: item.snippet.channelTitle,
            cover: item.snippet.thumbnails.high.url,
            source: 'youtube'
        }));
        render(ytFiles);
    } catch(e) {
        document.getElementById('music_grid').innerHTML = '<div style="color:var(--danger); width:100%; text-align:center; margin-top:50px;">No se pudo conectar con YouTube. Verifica los permisos de tu API.</div>';
    }
}

function showYouTubeSearch() {
    currentView = 'youtube';
    setActiveNav(document.getElementById('btn-youtube'));
    document.getElementById('main_search_bar').placeholder = "Buscar música en YouTube (presiona Enter)...";
    document.getElementById('main_search_bar').value = "";
    document.getElementById('music_grid').innerHTML = '<div style="color:var(--text-muted); width:100%; text-align:center; margin-top:50px;">Escribe y presiona Enter para buscar en YouTube</div>';
}

function showLibrary() { 
    currentView = 'library';
    document.getElementById('main_search_bar').placeholder = "Buscar en Drive...";
    setActiveNav(document.getElementById('btn-library')); 
    render(musicFiles); 
}

function showFavorites() { 
    currentView = 'favs';
    document.getElementById('main_search_bar').placeholder = "Buscar en Drive...";
    setActiveNav(document.getElementById('btn-favs')); 
    render(musicFiles.filter(f => userData.favorites.includes(f.id))); 
}

// --- EDICIÓN CANCIONES (SOLO DRIVE) - sin cambios ---
let currentEditSongId = null;
let tempBase64Cover = null;

function openEditTrackModal(id, defaultName) {
    currentEditSongId = id;
    tempBase64Cover = null;
    const meta = getTrackMeta(id, defaultName);

    const modal = document.getElementById('edit_track_modal');
    document.getElementById('edit_title_input').value = (userData.customMeta[id] && userData.customMeta[id].title) ? userData.customMeta[id].title : defaultName;
    document.getElementById('edit_artist_input').value = (userData.customMeta[id] && userData.customMeta[id].artist) ? userData.customMeta[id].artist : "";

    document.getElementById('cover_file_input').value = "";
    const preview = document.getElementById('cover_preview');
    const placeholder = document.getElementById('cover_upload_placeholder');
    
    if (userData.customCovers && userData.customCovers[id]) {
        preview.src = userData.customCovers[id];
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.src = "";
        preview.style.display = 'none';
        placeholder.style.display = 'block';
    }
    showModal(modal);
}

function openEditTrackModalForCurrent() {
    if (currentIndex >= 0 && playbackQueue[currentIndex]) {
        const song = playbackQueue[currentIndex];
        if(song.source === 'youtube') {
            notify("No se puede editar pistas de YouTube", "block");
            return;
        }
        openEditTrackModal(song.id, song.name.replace(/\.[^/.]+$/, ""));
    }
}

function previewCover(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 300; 
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            tempBase64Cover = canvas.toDataURL('image/webp', 0.7);
            
            document.getElementById('cover_preview').src = tempBase64Cover;
            document.getElementById('cover_preview').style.display = 'block';
            document.getElementById('cover_upload_placeholder').style.display = 'none';
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

async function saveTrackInfo() {
    const newTitle = document.getElementById('edit_title_input').value.trim();
    const newArtist = document.getElementById('edit_artist_input').value.trim();

    if (newTitle !== "" || newArtist !== "") {
        userData.customMeta[currentEditSongId] = { title: newTitle, artist: newArtist };
    } else {
        delete userData.customMeta[currentEditSongId];
    }
    if (tempBase64Cover) userData.customCovers[currentEditSongId] = tempBase64Cover;

    closeAllModals();
    await syncToDrive();
    notify("Información guardada", "edit_document");

    const currentList = document.querySelector('.nav-btn.active').id;
    if (currentList === 'btn-library') showLibrary();
    else if (currentList === 'btn-favs') showFavorites();
    else { showLibrary(); }

    if (playbackQueue[currentIndex] && playbackQueue[currentIndex].id === currentEditSongId) {
        const songName = playbackQueue[currentIndex].name.replace(/\.[^/.]+$/, "");
        const meta = getTrackMeta(currentEditSongId, songName);
        document.getElementById('track_title_standard').innerText = meta.title;
        document.getElementById('track_artist_standard').innerText = meta.artist;
        document.getElementById('track_title_immersive').innerText = meta.title;
        document.getElementById('track_artist_immersive').innerText = meta.artist;
        loadCover(currentEditSongId, meta.title, true);
    }
}

async function resetTrackInfo() {
    delete userData.customMeta[currentEditSongId];
    delete userData.customCovers[currentEditSongId];
    tempBase64Cover = null;
    
    closeAllModals();
    await syncToDrive();
    notify("Datos restaurados", "restore");
    showLibrary(); 

    if (playbackQueue[currentIndex] && playbackQueue[currentIndex].id === currentEditSongId) {
        const songName = playbackQueue[currentIndex].name.replace(/\.[^/.]+$/, "");
        document.getElementById('track_title_standard').innerText = songName;
        document.getElementById('track_artist_standard').innerText = "Artista Desconocido";
        document.getElementById('track_title_immersive').innerText = songName;
        document.getElementById('track_artist_immersive').innerText = "Artista Desconocido";
        loadCover(currentEditSongId, songName, true);
    }
}

async function loadCover(id, searchName, isPlayer = false, ytCoverUrl = null) {
    try {
        let url = GENERIC_COVER;
        
        if (ytCoverUrl) {
            url = ytCoverUrl;
        } else if (id && userData.customCovers && userData.customCovers[id]) {
            url = userData.customCovers[id]; 
        } else {
            const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchName)}&media=music&limit=1`);
            const data = await resp.json();
            url = (data.results?.[0]) ? data.results[0].artworkUrl100.replace('100x100','600x600') : GENERIC_COVER;
        }

        if (isPlayer) { 
            document.getElementById('current_cover_standard').src = url; 
            document.getElementById('current_cover_immersive').src = url; 
        } else { 
            const img = document.getElementById(`img-${id}`); 
            if(img) img.src = url; 
        }
    } catch(e) {}
}

// --- REPRODUCCIÓN DUAL (DRIVE Y YOUTUBE) ---
async function toggleFav(id) {
    userData.favorites = userData.favorites.includes(id) ? userData.favorites.filter(f => f !== id) :[...userData.favorites, id];
    const activeNav = document.querySelector('.nav-btn.active');
    if(activeNav) activeNav.click();
    await syncToDrive();
}

function renderPlaylists() {
    const menu = document.getElementById('playlist_menu');
    menu.innerHTML = "";
    Object.keys(userData.playlists).forEach(name => {
        const div = document.createElement('div');
        div.className = 'nav-btn';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex:1;" onclick="setActiveNav(this); renderPlaylist('${name}')">
                <span class="material-symbols-outlined">library_music</span>
                <span>${name}</span>
            </div>
            <span class="material-symbols-outlined delete-pl" onclick="event.stopPropagation(); deletePlaylist('${name}')">delete</span>`;
        menu.appendChild(div);
    });
}

function renderPlaylist(name) {
    currentView = 'playlist';
    document.getElementById('main_search_bar').placeholder = "Buscar en Drive...";
    const list = musicFiles.filter(f => userData.playlists[name].includes(f.id));
    render(list);
}

async function playFile(id, contextFiles = musicFiles) {
    playbackQueue = [...contextFiles];
    currentIndex = playbackQueue.findIndex(f => f.id === id);
    loadAndPlay(playbackQueue[currentIndex]);
}

// NUEVA FUNCIÓN: Mueve el reproductor de YT al contenedor adecuado y oculta/muestra imágenes
function relocateYouTubePlayer(isYT) {
    const standardImg = document.getElementById('current_cover_standard');
    const immersiveImg = document.getElementById('current_cover_immersive');
    const standardContainer = document.getElementById('standard_media_container');
    const immersiveContainer = document.getElementById('immersive_media_container');
    
    if (isYT) {
        // Ocultar imágenes
        standardImg.style.display = 'none';
        immersiveImg.style.display = 'none';
        
        // Mover el iframe de YT al contenedor según el modo actual
        const isExpanded = document.body.classList.contains('player-expanded');
        const targetContainer = isExpanded ? immersiveContainer : standardContainer;
        
        if (ytContainer.parentNode !== targetContainer) {
            targetContainer.appendChild(ytContainer);
        }
        
        // Asegurar que el contenedor YT tenga el tamaño correcto
        ytContainer.style.position = 'relative';
        ytContainer.style.width = '100%';
        ytContainer.style.height = '100%';
        ytContainer.style.zIndex = '5';
        ytContainer.style.pointerEvents = 'none'; // Para que los clics pasen al overlay de edición
        
        // Ajustar tamaño del iframe interno (ya está al 100%)
        // Forzar redimensionamiento del player
        if (ytPlayer && ytPlayer.getIframe) {
            const iframe = ytPlayer.getIframe();
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.objectFit = 'cover';
        }
    } else {
        // Restaurar imágenes
        standardImg.style.display = 'block';
        immersiveImg.style.display = 'block';
        
        // Mover YT player a su ubicación oculta original
        const hiddenContainer = document.body;
        if (ytContainer.parentNode !== hiddenContainer) {
            hiddenContainer.appendChild(ytContainer);
        }
        
        ytContainer.style.position = 'fixed';
        ytContainer.style.top = '0';
        ytContainer.style.left = '0';
        ytContainer.style.width = '0';
        ytContainer.style.height = '0';
        ytContainer.style.zIndex = '-1';
        ytContainer.style.pointerEvents = 'none';
    }
}

async function loadAndPlay(file) {
    if(!file) return;
    
    // Detener AMBOS reproductores antes de cambiar
    audio.pause();
    if(ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
    clearInterval(ytProgressInterval);

    const isYT = file.source === 'youtube';
    
    // Reubicar reproductor de YouTube según corresponda
    relocateYouTubePlayer(isYT);
    
    document.getElementById('play_btn').innerHTML = '<span class="material-symbols-outlined">pause</span>';
    
    if (isYT) {
        document.getElementById('track_title_standard').innerText = file.name;
        document.getElementById('track_artist_standard').innerText = file.artist;
        document.getElementById('track_title_immersive').innerText = file.name;
        document.getElementById('track_artist_immersive').innerText = file.artist;
        
        // No cargamos cover como imagen, se muestra el video
        // Pero podríamos precargar miniatura por si acaso
        // loadCover(file.id, file.name, true, file.cover); // Ya no necesario
        
        if(ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById(file.id);
            // El volumen se aplica en onReady, pero aseguramos
            setTimeout(() => setVolume(audio.volume), 500);
        }
    } else {
        const defaultName = file.name.replace(/\.[^/.]+$/, "");
        const meta = getTrackMeta(file.id, defaultName);

        document.getElementById('track_title_standard').innerText = meta.title;
        document.getElementById('track_artist_standard').innerText = meta.artist;
        document.getElementById('track_title_immersive').innerText = meta.title;
        document.getElementById('track_artist_immersive').innerText = meta.artist;
        
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if(audio.src) URL.revokeObjectURL(audio.src);
        audio.src = URL.createObjectURL(await resp.blob());
        audio.play();
        
        loadCover(file.id, meta.title, true);
    }
}

function togglePlay() {
    const isYT = playbackQueue[currentIndex]?.source === 'youtube';
    const btn = document.getElementById('play_btn');

    if (isYT) {
        if(ytPlayer && ytPlayer.getPlayerState) {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
                btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
            } else {
                ytPlayer.playVideo();
                btn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
            }
        }
    } else {
        if (audio.paused) { 
            audio.play(); 
            btn.innerHTML = '<span class="material-symbols-outlined">pause</span>'; 
        } else { 
            audio.pause(); 
            btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>'; 
        }
    }
}

function playNext() {
    if (playbackQueue.length === 0) return;
    if (isShuffle) { currentIndex = Math.floor(Math.random() * playbackQueue.length); } 
    else { currentIndex = (currentIndex + 1) % playbackQueue.length; }
    loadAndPlay(playbackQueue[currentIndex]);
}

function playPrev() {
    if (playbackQueue.length === 0) return;
    currentIndex = (currentIndex - 1 + playbackQueue.length) % playbackQueue.length;
    loadAndPlay(playbackQueue[currentIndex]);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    document.getElementById('shuffle_btn').classList.toggle('active', isShuffle);
    notify(isShuffle ? "Modo aleatorio" : "Modo lineal", "shuffle");
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('repeat_btn');
    const icons =["repeat", "repeat", "repeat_one"];
    btn.innerHTML = `<span class="material-symbols-outlined">${icons[repeatMode]}</span>`;
    
    if (repeatMode === 0) { btn.classList.remove('active'); notify("Repetición desactivada", "repeat"); } 
    else { btn.classList.add('active'); notify(repeatMode === 1 ? "Repetir cola" : "Repetir canción", icons[repeatMode]); }
}

function handleTrackEnd() {
    if (repeatMode === 2) { 
        // Repetir actual
        const isYT = playbackQueue[currentIndex]?.source === 'youtube';
        if (isYT) { if(ytPlayer) ytPlayer.seekTo(0); ytPlayer.playVideo(); }
        else { audio.currentTime = 0; audio.play(); }
    } 
    else if (repeatMode === 1) { playNext(); } 
    else {
        if (currentIndex < playbackQueue.length - 1) playNext();
        else document.getElementById('play_btn').innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    }
}

audio.onended = handleTrackEnd;

// Control de la barra de progreso
function seekAudio(val) {
    const isYT = playbackQueue[currentIndex]?.source === 'youtube';
    if (isYT) {
        if(ytPlayer && ytPlayer.seekTo) ytPlayer.seekTo(val, true);
    } else {
        audio.currentTime = val;
    }
}

// Control de Volumen
function setVolume(val) {
    audio.volume = val;
    if(ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val * 100);
}

audio.ontimeupdate = () => {
    const isYT = playbackQueue[currentIndex]?.source === 'youtube';
    if(isYT) return; // YT usa su propio setInterval

    const p = document.getElementById('prog');
    p.max = audio.duration || 0;
    p.value = audio.currentTime;
    document.getElementById('time_current').innerText = formatTime(audio.currentTime);
    document.getElementById('time_total').innerText = formatTime(audio.duration);
};

function formatTime(s) { if (isNaN(s)) return "0:00"; let m = Math.floor(s/60), sec = Math.floor(s%60); return `${m}:${sec<10?'0':''}${sec}`; }

function setActiveNav(el) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(el) el.classList.add('active');
}

// --- EXPANDIR/MINIMIZAR (se actualiza para reubicar video si es YT) ---
function expandPlayer() {
    document.body.classList.add('player-expanded');
    // Si la canción actual es de YouTube, mover el reproductor al contenedor inmersivo
    if (playbackQueue[currentIndex]?.source === 'youtube') {
        relocateYouTubePlayer(true);
    }
}

function minimizePlayer() {
    document.body.classList.remove('player-expanded');
    if (playbackQueue[currentIndex]?.source === 'youtube') {
        relocateYouTubePlayer(true);
    }
}

// --- Modales Generales (sin cambios) ---
function showModal(el) {
    document.getElementById('overlay').style.display = 'block';
    el.style.display = 'block';
    setTimeout(() => el.classList.add('show'), 10);
}

function closeAllModals() {
    document.getElementById('overlay').style.display = 'none';
    document.querySelectorAll('.glass-modal').forEach(m => {
        m.classList.remove('show');
        setTimeout(() => m.style.display = 'none', 300);
    });
}

function openNewPlaylistModal() {
    const modal = document.getElementById('create_modal');
    document.getElementById('modal_input').value = "";
    showModal(modal);
}

async function saveNewPlaylist() {
    const name = document.getElementById('modal_input').value.trim();
    if (name && !userData.playlists[name]) {
        userData.playlists[name] =[];
        renderPlaylists();
        closeAllModals();
        await syncToDrive();
        notify("Playlist creada");
    }
}

function deletePlaylist(name) {
    const modal = document.getElementById('confirm_modal');
    document.getElementById('confirm_title').innerText = `¿Eliminar "${name}"?`;
    document.getElementById('confirm_btn').onclick = async () => {
        delete userData.playlists[name];
        renderPlaylists();
        await syncToDrive();
        closeAllModals();
        notify("Playlist eliminada", "delete");
    };
    showModal(modal);
}

function showPlaylistPicker(songId) {
    const modal = document.getElementById('picker_modal');
    const list = document.getElementById('picker_list');
    list.innerHTML = "";
    const plNames = Object.keys(userData.playlists);
    if (plNames.length === 0) return notify("Crea una playlist primero", "warning");
    plNames.forEach(name => {
        const div = document.createElement('div');
        div.className = "picker-option";
        div.innerText = name;
        div.onclick = async () => {
            if (!userData.playlists[name].includes(songId)) {
                userData.playlists[name].push(songId);
                await syncToDrive();
                notify("Añadida a " + name);
            }
            closeAllModals();
        };
        list.appendChild(div);
    });
    showModal(modal);
}