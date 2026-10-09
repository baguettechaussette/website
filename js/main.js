function syncMenuIcon(isOpen) {
    const icon = document.querySelector('.menu-toggle img');
    if (!icon) return;
    icon.src = isOpen ? 'img/symbols/close.svg' : 'img/symbols/menu.svg';
    icon.alt = isOpen ? 'Fermer' : 'Menu hamburger';
}

function closeMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');
    if (!navLinks) return;
    navLinks.classList.remove('active');
    syncMenuIcon(false);
    document.body.style.overflow = '';
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
    }
}

function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');

    if (navLinks) {
        const isOpen = navLinks.classList.toggle('active');
        syncMenuIcon(isOpen);

        // Amélioration a11y
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', isOpen);
            menuToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
        }

        if (window.innerWidth <= 768) {
            document.body.style.overflow = isOpen ? 'hidden' : '';
        }
    }
}

// Ferme le menu au clic en dehors
document.addEventListener('click', (e) => {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');
    const navbar = document.getElementById('navbar');

    if (navLinks && navLinks.classList.contains('active') &&
        (!navbar.contains(e.target) || e.target === navLinks)) {
        navLinks.classList.remove('active');
        syncMenuIcon(false);
        document.body.style.overflow = '';
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const navLinks = document.getElementById('navLinks');
    if (!navLinks || !navLinks.classList.contains('active')) return;
    navLinks.classList.remove('active');
    syncMenuIcon(false);
    document.body.style.overflow = '';
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.focus();
    }
});

function scrollBehavior() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function anchorBox(target) {
    if (target.getClientRects().length) return target;
    const band = target.closest('.band');
    if (band && band.getClientRects().length) return band;
    let el = target.firstElementChild;
    while (el && !el.getClientRects().length) el = el.firstElementChild || el.nextElementSibling;
    return el || target;
}

function scrollToAnchor(target, behavior) {
    const box = anchorBox(target);
    const navbar = document.getElementById('navbar');
    const navBas = navbar ? navbar.getBoundingClientRect().bottom : 80;
    const top = box.getBoundingClientRect().top + window.pageYOffset - navBas - 16;
    window.scrollTo({ top: Math.max(0, top), behavior });
}

window.addEventListener('load', () => {
    if (!location.hash) return;
    let target;
    try { target = document.querySelector(location.hash); } catch { return; }
    if (target) setTimeout(() => scrollToAnchor(target, 'instant'), 50);
});

// Smooth scroll pour les liens d'ancres
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    const statUmami = anchor.classList.contains('js-email') ? null : anchor.dataset.umamiEvent;
    if (statUmami) anchor.removeAttribute('data-umami-event');

    anchor.addEventListener('click', (e) => {
        if (statUmami && window.umami && typeof window.umami.track === 'function') {
            window.umami.track(statUmami);
        }
        const href = anchor.getAttribute('href');

        // Ignore les liens vides
        if (href === '#') {
            e.preventDefault();
            return;
        }

        if (!href || href.charAt(0) !== '#') return;

        const target = document.querySelector(href);

        if (target) {
            e.preventDefault();

            const navLinks = document.getElementById('navLinks');
            if (navLinks) {
                closeMenu();
                if (navLinks.contains(anchor)) {
                    navLinks.querySelectorAll('a[aria-current]').forEach(a => a.removeAttribute('aria-current'));
                    anchor.setAttribute('aria-current', 'page');
                }
            }

            // Scroll avec offset pour la navbar fixe
            scrollToAnchor(target, scrollBehavior());
        }
    });
});

// Navbar scroll effect avec debounce
let scrollTimer;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
    }, 10);
}, { passive: true });

// Animation du compteur

function milliers(n) {
    return n.toLocaleString('fr-FR').replace(/\s/g, String.fromCharCode(8239));
}
function animateCounter(element, start, end, duration, suffix = '', prefix = '') {
    const startTime = performance.now();
    const range = end - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.max(0, Math.min(elapsed / duration, 1));

        // Easing: easeOutQuad
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        const current = Math.floor(start + range * easeProgress);

        element.textContent = prefix + milliers(current) + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = prefix + milliers(end) + suffix;
        }
    }

    requestAnimationFrame(update);
}

async function loadFollowersCount(retries = 3) {
    const el = document.getElementById('followersCount');
    if (!el) return;

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('data/followers.json', {
                cache: 'no-store',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (Number.isFinite(data.followers) && data.followers > 0) {
                // Animation du compteur
                animateCounter(el, 0, data.followers, 1500);
                updateFollowerGoal(data.followers);
                setTimeout(() => {
                    const announce = document.getElementById('followersAnnounce');
                    if (announce) announce.textContent = `${data.followers.toLocaleString('fr-FR')} followers Twitch`;
                }, 1600);
                return;
            } else {
                throw new Error('Invalid followers count');
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`Tentative ${i + 1}/${retries}: Timeout`);
            } else {
                console.warn(`Tentative ${i + 1}/${retries}:`, err.message);
            }

            if (i === retries - 1) {
                el.title = 'Données temporairement indisponibles';
                animateCounter(el, 0, 2200, 1200, '', '+');
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
}

// Barre de progression vers l'objectif de followers
function nextFollowerGoal(followers) {
    const step = followers < 5000 ? 500 : 1000;
    return Math.floor(followers / step) * step + step;
}

const FOLLOWER_GOAL_THRESHOLD = 100;

function updateFollowerGoal(followers) {
    const wrap  = document.getElementById('followerGoal');
    const fill  = document.getElementById('followerGoalFill');
    const label = document.getElementById('followerGoalLabel');
    if (!wrap || !fill || !label) return;

    const goal = nextFollowerGoal(followers);
    const reste = goal - followers;

    if (reste > FOLLOWER_GOAL_THRESHOLD) {
        wrap.hidden = true;
        return;
    }

    const pct = Math.min(100, Math.round((followers / goal) * 100));
    fill.setAttribute('aria-valuemax', goal);
    fill.setAttribute('aria-valuenow', followers);
    label.textContent = `Objectif ${goal.toLocaleString('fr-FR')} p'tits pains : plus que ${reste.toLocaleString('fr-FR')} !`;

    wrap.hidden = false;
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
}

// Gestion du resize avec debounce
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        const navLinks = document.getElementById('navLinks');

        // Réinitialise le menu sur desktop
        if (window.innerWidth > 768 && navLinks) {
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        }
    }, 250);
}, { passive: true });

function initDragScroll(strip) {
    let down = false, moved = false, startX = 0, startLeft = 0, pending = 0, raf = 0, settle = 0;

    const end = () => {
        if (!down) return;
        down = false;
        strip.classList.remove('is-grabbing');
        if (raf) { cancelAnimationFrame(raf); raf = 0; strip.scrollLeft = pending; }
        if (!moved) { strip.style.scrollSnapType = ''; return; }
        const padLeft   = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
        const stripLeft = strip.getBoundingClientRect().left;
        let best = strip.scrollLeft, bestDist = Infinity;
        Array.from(strip.children).forEach(item => {
            const left = item.getBoundingClientRect().left - stripLeft + strip.scrollLeft - padLeft;
            const dist = Math.abs(left - strip.scrollLeft);
            if (dist < bestDist) { bestDist = dist; best = left; }
        });
        strip.scrollTo({ left: best, behavior: 'smooth' });
        clearTimeout(settle);
        settle = setTimeout(() => { strip.style.scrollSnapType = ''; }, 450);
    };

    strip.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (strip.scrollWidth <= strip.clientWidth) return;
        down = true; moved = false;
        startX = e.clientX; startLeft = strip.scrollLeft;
        clearTimeout(settle);
        strip.style.scrollSnapType = 'none';
        strip.classList.add('is-grabbing');
    });
    strip.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 4) {
            moved = true;
            strip.setPointerCapture(e.pointerId);
        }
        if (!moved) return;
        pending = startLeft - dx;
        if (!raf) raf = requestAnimationFrame(() => { strip.scrollLeft = pending; raf = 0; });
    });
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', end);
    strip.addEventListener('dragstart', (e) => e.preventDefault());
    strip.addEventListener('click', (e) => {
        if (!moved) return;
        e.preventDefault();
        e.stopPropagation();
        moved = false;
    }, true);
}

function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    // Éléments simples
    [
        // index.html
        '.section-header',
        '.contact-info-box',
        // events.html
        '.event-intro',
        '.event-stats-strip',
        '.event-podium-section',
        '.dti-gallery-block',
        '.dti-section-title',
    ].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.classList.add('scroll-reveal');
            observer.observe(el);
        });
    });

    // Éléments avec stagger
    [
        // index.html
        { parent: '.schedule-grid',        child: '.schedule-item',       delay: 0.10 },
        { parent: '.events-archive-grid',  child: '.event-archive-card',  delay: 0.07 },
        { parent: '.contact-cards',        child: '.contact-card',        delay: 0.10 },
        { parent: '.partners-container',   child: '.partner-card',        delay: 0.12 },
        { parent: '.social-grid',          child: '.social-card',         delay: 0.07 },
        // events.html
        { parent: '.event-stats-strip',                  child: '.event-stat-chip', delay: 0.07 },
        { parent: '.event-podium',                       child: '.podium-card',     delay: 0.10 },
        { parent: '.dti-photo-grid',                     child: '.dti-photo-item',  delay: 0.05 },
        { parent: '#baguettectober-2025 .gallery-grid',  child: '.gallery-item',    delay: 0.07 },
    ].forEach(({ parent, child, delay }) => {
        document.querySelectorAll(parent).forEach(parentEl => {
            parentEl.querySelectorAll(child).forEach((el, i) => {
                el.classList.add('scroll-reveal');
                el.style.setProperty('--sr-delay', `${i * delay}s`);
                observer.observe(el);
            });
        });
    });
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Charge les followers
    loadFollowersCount();
    animateStaticCounters();
    initScrollReveal();

    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'navLinks');
        menuToggle.addEventListener('click', toggleMenu);
    }

    // Année dynamique dans le footer
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    document.querySelectorAll('.partner-toggle, .event-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.partner-card, .event-container');
            if (!card) return;
            const collapsed = card.classList.toggle('is-collapsed');
            btn.setAttribute('aria-expanded', String(!collapsed));
        });
    });

    if (window.matchMedia('(min-width: 769px)').matches) {
        const first = document.querySelector('.partners-container .partner-card.is-collapsed');
        if (first) {
            first.classList.remove('is-collapsed');
            first.querySelector('.partner-toggle')?.setAttribute('aria-expanded', 'true');
        }
        document.querySelector('.faq-container .faq-item')?.setAttribute('open', '');

        document.querySelectorAll('.event-container.is-collapsible > .event-intro').forEach(intro => {
            intro.addEventListener('click', (e) => {
                if (e.target.closest('a, .event-toggle')) return;
                intro.querySelector('.event-toggle')?.click();
            });
        });
    }

    (function openLatestEdition() {
        const first = document.querySelector('.band-archive .event-container.is-collapsible.is-collapsed');
        if (!first) return;
        first.classList.remove('is-collapsed');
        first.querySelector('.event-toggle')?.setAttribute('aria-expanded', 'true');
    })();

    function expandHashTarget() {
        if (!location.hash) return;
        let target;
        try { target = document.querySelector(location.hash); } catch { return; }
        const card = target && target.querySelector('.event-container.is-collapsed');
        if (!card) return;
        card.classList.remove('is-collapsed');
        card.querySelector('.event-toggle')?.setAttribute('aria-expanded', 'true');
    }
    expandHashTarget();
    window.addEventListener('hashchange', expandHashTarget);

    document.querySelectorAll('.dti-photo-grid, .cow-grid, .clips-grid').forEach(initDragScroll);

    // Emails assemblés côté client
    document.querySelectorAll('.js-email').forEach(el => {
        const addr = `${el.dataset.user}@${el.dataset.domain}`;
        el.setAttribute('href', 'mailto:' + addr);
        if ('showText' in el.dataset) el.textContent = addr;
    });

    document.querySelectorAll('.contact-email.js-email').forEach(btn => {
        const addr = `${btn.dataset.user}@${btn.dataset.domain}`;
        btn.title = "Cliquer pour copier l'adresse";
        let timer = 0;
        const statUmami = btn.dataset.umamiEvent;
        btn.removeAttribute('data-umami-event');
        const stat = (mode) => {
            if (statUmami && window.umami && typeof window.umami.track === 'function') {
                window.umami.track(statUmami, { mode });
            }
        };
        const text = document.createElement('span');
        text.className = 'contact-email-text';
        text.textContent = addr;
        const bubble = document.createElement('span');
        bubble.className = 'contact-email-bubble';
        bubble.setAttribute('role', 'status');
        bubble.textContent = 'Adresse copiée';
        btn.replaceChildren(text, bubble);

        const montrerCopie = () => {
            btn.classList.remove('is-copied');
            void btn.offsetWidth;
            btn.classList.add('is-copied');
            clearTimeout(timer);
            timer = setTimeout(() => btn.classList.remove('is-copied'), 1600);
        };
        const copieDeSecours = () => {
            const zone = document.createElement('textarea');
            zone.value = addr;
            zone.setAttribute('readonly', '');
            zone.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(zone);
            zone.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
            zone.remove();
            return ok;
        };

        btn.addEventListener('click', (e) => {
            const pointeur = e.pointerType
                || (window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
            if (pointeur === 'touch' || pointeur === 'pen') { stat('mailto'); return; }
            e.preventDefault();
            stat('copie');
            const ouvrirMail = () => { window.location.href = 'mailto:' + addr; };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(addr)
                    .then(montrerCopie)
                    .catch(() => (copieDeSecours() ? montrerCopie() : ouvrirMail()));
            } else if (copieDeSecours()) {
                montrerCopie();
            } else {
                ouvrirMail();
            }
        });
    });

    loadTopClips();
});

function clipDisplayTitle(clip) {
    if (clip.title) return clip.title;
    if (clip.created_at) {
        const d = new Date(clip.created_at);
        if (!isNaN(d)) return `Clip du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    }
    return 'Clip mystère';
}

async function loadTopClips() {
    const section = document.getElementById('clips');
    const grid = document.getElementById('clipsGrid');
    if (!section || !grid) return;

    const limit = parseInt(grid.dataset.limit, 10) || 16;
    const source = grid.dataset.source;

    const skeletons = Array.from({ length: source === 'week' ? Math.min(limit, 4) : limit }, () => {
        const s = document.createElement('div');
        s.className = 'clip-skeleton';
        s.setAttribute('aria-hidden', 'true');
        grid.appendChild(s);
        return s;
    });

    try {
        if (source === 'week') {
            const rw = await fetch('/data/clip-of-week.json', { cache: 'no-store' });
            if (!rw.ok) return;
            const cow = await rw.json();
            const finalists = (Array.isArray(cow.finalists) ? cow.finalists : []).filter(c => c && c.id);
            if (finalists.length < 2) return;
            const montres = finalists.slice(0, limit);
            montres.forEach(clip => grid.appendChild(buildClipCard(clip, '(max-width: 768px) 46vw, 160px')));
            if (finalists.length > montres.length) {
                const reste = finalists.length - montres.length + 1;
                const derniere = grid.lastElementChild;
                if (derniere) {
                    derniere.classList.add('clip-card-more');
                    const play = derniere.querySelector('.clip-play');
                    if (play) play.textContent = '+' + reste;
                    const vignette = derniere.querySelector('.clip-thumb');
                    if (vignette) {
                        vignette.setAttribute('aria-label', `Voir les ${reste} autres finalistes`);
                        vignette.setAttribute('data-umami-event', 'Home - Vote - Autres finalistes');
                        vignette.addEventListener('click', (e) => {
                            e.stopImmediatePropagation();
                            window.location.href = '/clips#clip-semaine';
                        }, true);
                    }
                }
            }
            section.hidden = false;
            return;
        }

        const exclude = new Set();
        if (document.getElementById('cowGrid')) {
            try {
                const [rCow, rHof] = await Promise.all([
                    fetch('/data/clip-of-week.json', { cache: 'no-store' }),
                    fetch('/data/hall-of-fame.json', { cache: 'no-store' }),
                ]);
                if (rCow.ok) {
                    const cow = await rCow.json();
                    (Array.isArray(cow.finalists) ? cow.finalists : []).forEach(f => f?.id && exclude.add(f.id));
                    if (cow.winner?.id) exclude.add(cow.winner.id);
                }
                if (rHof.ok) {
                    const hof = await rHof.json();
                    (Array.isArray(hof.winners) ? hof.winners : []).forEach(w => w?.id && exclude.add(w.id));
                }
            } catch {}
        }

        const response = await fetch('/data/top-clips.json');
        if (!response.ok) return;

        const data = await response.json();
        const pinned = (Array.isArray(data.pinned) ? data.pinned : []).map(c => ({ ...c, pinned: true }));
        const autos = Array.isArray(data.clips) ? data.clips : [];

        const keep = (list, applyExclude = true) => {
            const seen = new Set();
            return list.filter(clip => {
                if (!clip.id || seen.has(clip.id)) return false;
                if (applyExclude && exclude.has(clip.id)) return false;
                seen.add(clip.id);
                return true;
            });
        };

        const clips = keep(autos).slice(0, limit);
        clips.forEach(clip => grid.appendChild(buildClipCard(clip)));
        if (grid.children.length) section.hidden = false;
    } catch (err) {
        console.debug('Top clips indisponibles:', err.message);
    } finally {
        skeletons.forEach(s => s.remove());
    }
}

function setClipThumbSources(img, url, sizes) {
    if (/-480x272\.jpg$/.test(url)) {
        img.sizes = sizes;
        const at = (s) => url.replace('-480x272.jpg', `-${s}.jpg`);
        img.srcset = `${at('260x147')} 260w, ${url} 480w, ${at('960x540')} 960w, ${at('1280x720')} 1280w`;
    }
    img.width = 480;
    img.height = 272;
    img.src = url;
}

function buildClipCard(clip, sizes = '(max-width: 768px) 46vw, 400px') {
    const card = document.createElement('div');
    card.className = 'clip-card';

    const displayTitle = clipDisplayTitle(clip);

    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'clip-thumb';
    thumb.setAttribute('data-umami-event', 'Clips - Play');
    thumb.setAttribute('aria-label', `Lire le clip : ${displayTitle}`);

    if (clip.thumbnail_url) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        setClipThumbSources(img, clip.thumbnail_url, sizes);
        thumb.appendChild(img);
    }

    const play = document.createElement('span');
    play.className = 'clip-play';
    play.setAttribute('aria-hidden', 'true');
    play.textContent = '▶';
    thumb.appendChild(play);

    thumb.addEventListener('click', () => openClipModal(clip));
    card.appendChild(thumb);

    const meta = document.createElement('p');
    meta.className = 'clip-meta';
    if (clip.pinned) {
        const pin = document.createElement('span');
        pin.className = 'clip-pin';
        pin.textContent = '📌';
        pin.title = 'Clip épinglé';
        meta.append(pin, document.createTextNode(clip.title || 'Clip épinglé'));
    } else {
        meta.textContent = `« ${displayTitle} »`;
    }
    card.appendChild(meta);

    if (clip.creator_name) {
        const by = document.createElement('p');
        by.className = 'clip-clipper';
        by.textContent = `clippé par ${clip.creator_name}`;
        card.appendChild(by);
    }

    return card;
}

// Modale de lecture des clips
let clipModalLastFocus = null;

function ensureClipModal() {
    let overlay = document.getElementById('clipModal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'clipModal';
    overlay.className = 'clip-modal';
    overlay.innerHTML =
        '<div class="clip-modal__content" role="dialog" aria-modal="true" aria-label="Lecture du clip">' +
        '<button type="button" class="clip-modal__close" aria-label="Fermer">✕</button>' +
        '<div class="clip-modal__player"></div>' +
        '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeClipModal();
    });
    overlay.querySelector('.clip-modal__close').addEventListener('click', closeClipModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeClipModal();
    });

    return overlay;
}

function openClipModal(clip) {
    const overlay = ensureClipModal();
    const player = overlay.querySelector('.clip-modal__player');

    const iframe = document.createElement('iframe');
    iframe.src = 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(clip.id) +
        '&parent=' + location.hostname + '&autoplay=true';
    iframe.title = (clip.pinned && clip.title) || 'Clip Twitch';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    player.replaceChildren(iframe);

    clipModalLastFocus = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.clip-modal__close').focus();
}

function closeClipModal() {
    const overlay = document.getElementById('clipModal');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.querySelector('.clip-modal__player').replaceChildren();
    document.body.style.overflow = '';
    clipModalLastFocus?.focus({ preventScroll: true });
}

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    if (event.message && !event.message.includes('ResizeObserver')) {
        console.error('Erreur:', event.message, 'Fichier:', event.filename, 'Ligne:', event.lineno);
    }
});

// Animation des autres compteurs statiques
function animateStaticCounters() {
    [
        '.stat-box:nth-child(2) .stat-number',
        '.stat-box:nth-child(3) .stat-number',
    ].forEach(selector => {
        const el = document.querySelector(selector);
        if (!el) return;
        const texte = el.textContent.trim();
        const target = parseInt(texte.replace(/\D/g, '')) || 0;
        const m = texte.match(/^(\D*)[\d\s]*\d(.*)$/);
        const avant = m ? m[1] : '';
        const apres = m ? m[2] : '';
        el.textContent = avant + '0' + apres;
        el.style.opacity = '1';
        animateCounter(el, 0, target, 1200, apres, avant);
    });
}

// Back to top button
(function () {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    const threshold = 400;

    window.addEventListener('scroll', () => {
        if (window.scrollY > threshold) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });
})();

window.BaguetteChaussette = {
    toggleMenu,
    loadFollowersCount,
    animateCounter
};

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.warn('SW:', err));
    });
}