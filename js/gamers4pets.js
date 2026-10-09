(function () {
    'use strict';

    const START = new Date('2026-10-02T20:00:00+02:00').getTime();
    const END   = new Date('2026-10-04T23:59:00+02:00').getTime();

    document.addEventListener('DOMContentLoaded', () => {
        initCountdown();
        loadDonors();
    });

    // Compte à rebours
    function initCountdown() {
        const root = document.getElementById('g4pCountdown');
        if (!root) return;
        if (Date.now() >= END) return;

        const value = root.querySelector('.g4p-countdown-value');
        const label = root.querySelector('.g4p-countdown-label');
        const units = {
            days:  root.querySelector('[data-unit="days"]'),
            hours: root.querySelector('[data-unit="hours"]'),
            mins:  root.querySelector('[data-unit="mins"]')
        };
        if (!value || !label || !units.days || !units.hours || !units.mins) return;

        function render() {
            const now = Date.now();

            if (now >= END) {
                root.hidden = true;
                return false;
            }

            if (now >= START) {
                root.classList.add('is-live');
                value.textContent = 'En live';
                label.textContent = 'ça se passe maintenant !';
                return true;
            }

            const diff = START - now;
            units.days.textContent  = String(Math.floor(diff / 86400000));
            units.hours.textContent = String(Math.floor(diff / 3600000) % 24);
            units.mins.textContent  = String(Math.floor(diff / 60000) % 60);
            return true;
        }

        if (!render()) return;
        root.hidden = false;

        const timer = setInterval(() => {
            if (!render()) clearInterval(timer);
        }, 30000);
    }

    // Mur des donateurs
    async function loadDonors() {
        const btn = document.getElementById('g4pDonorBtn');
        if (!btn) return;

        const note = document.getElementById('g4pDonorNote');

        let raw = [];
        try {
            const r = await fetch('/data/gamers4pets-donors.json', { cache: 'no-store' });
            if (!r.ok) return;
            const data = await r.json();
            raw = Array.isArray(data.donors) ? data.donors : [];
        } catch {
            return;
        }

        const names = raw
            .map(d => (typeof d === 'string' ? d : (d && d.name)))
            .filter(n => typeof n === 'string' && n.trim())
            .map(n => n.trim())
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (!names.length) {
            if (note) note.textContent = "Le mur s'ouvrira très bientôt.";
            return;
        }

        if (note) note.hidden = true;
        btn.disabled = false;
        btn.addEventListener('click', () => openDonorModal(names));

        const count = document.getElementById('g4pDonorCount');
        if (count) {
            count.textContent = names.length > 1
                ? `${names.length} p'tits pains ont donné pour les refuges, un immense merci 🫶`
                : "Un p'tit pain a donné pour les refuges, un immense merci 🫶";
            count.hidden = false;
        }
        renderPreview(names, btn);
    }

    function renderPreview(names, btn) {
        const preview = document.getElementById('g4pDonorPreview');
        if (!preview) return;

        const max = window.matchMedia('(max-width: 768px)').matches ? 8 : 12;
        const tirage = names.slice();
        for (let i = tirage.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tirage[i], tirage[j]] = [tirage[j], tirage[i]];
        }
        const montres = tirage.length > max ? tirage.slice(0, max) : tirage;

        const frag = document.createDocumentFragment();
        montres.forEach(name => {
            const li = makeEl('li', 'g4p-donor-chip', name);
            li.title = name;
            frag.appendChild(li);
        });
        const reste = names.length - montres.length;
        if (reste > 0) {
            const li = makeEl('li', 'g4p-donor-more-item');
            const more = makeEl('button', 'g4p-donor-more', `+${reste}`);
            more.type = 'button';
            more.setAttribute('aria-label', `Voir les ${reste} autres p'tits pains`);
            more.addEventListener('click', () => btn.click());
            li.appendChild(more);
            frag.appendChild(li);
        }
        preview.replaceChildren(frag);
        preview.hidden = false;
    }

    // Modale
    let modal = null;
    let lastFocus = null;

    function ensureModal() {
        if (modal) return modal;

        modal = document.createElement('div');
        modal.className = 'g4p-modal';
        modal.id = 'g4pDonorModal';

        const content = makeEl('div', 'g4p-modal__content');
        content.setAttribute('role', 'dialog');
        content.setAttribute('aria-modal', 'true');
        content.setAttribute('aria-labelledby', 'g4pModalTitle');

        const close = makeEl('button', 'g4p-modal__close', '✕');
        close.type = 'button';
        close.setAttribute('aria-label', 'Fermer');
        close.addEventListener('click', closeDonorModal);

        const title = makeEl('h3', 'g4p-modal__title', "Les p'tits pains au grand cœur");
        title.id = 'g4pModalTitle';

        content.append(close, title, makeEl('p', 'g4p-modal__subtitle'), makeEl('ul', 'g4p-modal__list'));
        modal.appendChild(content);
        document.body.appendChild(modal);

        modal.addEventListener('click', e => { if (e.target === modal) closeDonorModal(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) closeDonorModal();
        });

        return modal;
    }

    function openDonorModal(names) {
        const m = ensureModal();

        m.querySelector('.g4p-modal__subtitle').textContent = names.length > 1
            ? `${names.length} p'tits pains, un immense merci à vous 🫶`
            : 'Un immense merci à vous 🫶';

        const list = m.querySelector('.g4p-modal__list');
        const frag = document.createDocumentFragment();
        names.forEach(name => frag.appendChild(makeEl('li', 'g4p-donor', name)));
        list.replaceChildren(frag);

        lastFocus = document.activeElement;
        m.classList.add('is-open');
        document.body.classList.add('g4p-modal-open');
        document.body.style.overflow = 'hidden';
        m.querySelector('.g4p-modal__close').focus();
        rainHearts(m);
    }

    const HEART_COUNT = 18;

    function placeHeart(heart) {
        heart.style.left = (Math.random() * 92) + '%';
        heart.style.width = (14 + Math.random() * 12).toFixed(1) + 'px';
        heart.style.setProperty('--drift', Math.round(Math.random() * 80 - 40) + 'px');
        heart.style.setProperty('--spin', Math.round(Math.random() * 540 - 270) + 'deg');
    }

    function rainHearts(overlay) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        clearHearts(overlay);

        const layer = makeEl('div', 'g4p-hearts');
        layer.setAttribute('aria-hidden', 'true');

        for (let i = 0; i < HEART_COUNT; i++) {
            const heart = document.createElement('img');
            heart.className = 'g4p-heart';
            heart.src = '/img/emoji/1f9e1.svg';
            heart.alt = '';
            placeHeart(heart);
            heart.style.animationDuration = (3.2 + Math.random() * 2.0).toFixed(2) + 's';
            heart.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
            heart.style.animationIterationCount = 'infinite';
            heart.addEventListener('animationiteration', () => placeHeart(heart));
            layer.appendChild(heart);
        }

        overlay.appendChild(layer);
    }

    function clearHearts(overlay) {
        overlay.querySelector('.g4p-hearts')?.remove();
    }

    function closeDonorModal() {
        if (!modal) return;
        clearHearts(modal);
        modal.classList.remove('is-open');
        document.body.classList.remove('g4p-modal-open');
        document.body.style.overflow = '';
        lastFocus?.focus({ preventScroll: true });
    }

    function makeEl(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    }
})();
