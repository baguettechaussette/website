document.addEventListener('DOMContentLoaded', () => {
    // --------------------------
    // Données des galeries
    // --------------------------
    // ══════════════════════════════════════════════════════════════
    // POUR AJOUTER UNE NOUVELLE ÉDITION DE BAGUETTECTOBER :
    //   1. Copie le bloc baguettectober2025 ci-dessous
    //   2. Renomme la clé → baguettectober2026 (ou l'année voulue)
    //   3. Mets les chemins d'images dans img/baguettectober-2026/
    //   4. Ajoute le binding dans initViewer() plus bas
    // ══════════════════════════════════════════════════════════════
    const GALLERIES = {
        // Baguettectober — Octobre 2025
        baguettectober2025: {
            w1: [
                {src: 'img/baguettectober/w1/baguette.webp', caption: 'Auteur : Baguette Chaussette'},
                {src: 'img/baguettectober/w1/barbouy.webp', caption: 'Auteur : Barbouy'},
                {src: 'img/baguettectober/w1/bunny.webp', caption: 'Auteur : Bunny / Madi'},
                {src: 'img/baguettectober/w1/calypsoraven.webp', caption: 'Auteur : CalypsoRaven'},
                {src: 'img/baguettectober/w1/eirian.webp', caption: 'Auteur : Eirian'},
                {src: 'img/baguettectober/w1/hiimaxou.webp', caption: 'Auteur : Hiimaxou'},
                {src: 'img/baguettectober/w1/lydais.webp', caption: 'Auteur : Lydaïs'},
                {src: 'img/baguettectober/w1/maximepr.webp', caption: 'Auteur : Maximepr'},
            ],
            w2: [
                {src: 'img/baguettectober/w2/baguette.webp', caption: 'Auteur : Baguette Chaussette'},
                {src: 'img/baguettectober/w2/barbouy.webp', caption: 'Auteur : Barbouy'},
                {src: 'img/baguettectober/w2/eirian.webp', caption: 'Auteur : Eirian'},
                {src: 'img/baguettectober/w2/hiimaxou.webp', caption: 'Auteur : Hiimaxou'},
                {src: 'img/baguettectober/w2/maximepr.webp', caption: 'Auteur : Maximepr'},
            ],
            w3: [
                {src: 'img/baguettectober/w3/baguette.webp', caption: 'Auteur : Baguette Chaussette'},
                {src: 'img/baguettectober/w3/barbouy.webp', caption: 'Auteur : Barbouy'},
                {src: 'img/baguettectober/w3/eirian.webp', caption: 'Auteur : Eirian'},
                {src: 'img/baguettectober/w3/hiimaxou.webp', caption: 'Auteur : Hiimaxou'},
                {src: 'img/baguettectober/w3/maximepr.webp', caption: 'Auteur : Maximepr'},
            ],
            w4: [
                {src: 'img/baguettectober/w4/baguette.webp', caption: 'Auteur : Baguette Chaussette'},
                {src: 'img/baguettectober/w4/barbouy.webp', caption: 'Auteur : Barbouy'},
                {src: 'img/baguettectober/w4/eirian.webp', caption: 'Auteur : Eirian'},
                {src: 'img/baguettectober/w4/emeline.webp', caption: 'Auteur : Emeline59'},
                {src: 'img/baguettectober/w4/hiimaxou.webp', caption: 'Auteur : Hiimaxou'},
                {src: 'img/baguettectober/w4/kyuwha.webp', caption: 'Auteur : Kyuwha'},
                {src: 'img/baguettectober/w4/maximepr.webp', caption: 'Auteur : Maximepr'},
            ],
            bonus: [
                {src: 'img/baguettectober/bonus/baguette.webp', caption: 'Auteur : Baguette Chaussette'},
                {src: 'img/baguettectober/bonus/barbouy.webp', caption: 'Auteur : Barbouy'},
                {src: 'img/baguettectober/bonus/hiimaxou.webp', caption: 'Auteur : Hiimaxou'},
                {src: 'img/baguettectober/bonus/lydais.webp', caption: 'Auteur : Lydaïs'},
            ]
        },
    };

    // --------------------------
    // Viewer d'images (DTI + Baguettectober)
    // --------------------------
    (function initViewer() {
        const tpl = `
    <div class="dti-viewer" id="dtiViewer" aria-modal="true" role="dialog" aria-label="Galerie" aria-hidden="true">
      <div class="dti-viewer__toolbar">
        <p class="dti-viewer__caption" id="dtiViewerCaption"></p>
        <button class="dti-viewer__expand" id="dtiViewerExpand" aria-label="Agrandir" aria-keyshortcuts="f" title="Agrandir (F)">
          <img src="img/symbols/fullscreen.svg" alt="">
        </button>
        <button class="dti-viewer__close" id="dtiViewerClose" aria-label="Fermer">
          <img src="img/symbols/close.svg" alt="">
        </button>
      </div>
      <div class="dti-viewer__stage">
        <button class="dti-viewer__nav dti-viewer__prev" id="dtiViewerPrev" aria-label="Précédent">
          <img src="img/symbols/arrow_back_ios.svg" alt="">
        </button>
        <img class="dti-viewer__img" id="dtiViewerImg" alt="">
        <button class="dti-viewer__nav dti-viewer__next" id="dtiViewerNext" aria-label="Suivant">
          <img src="img/symbols/arrow_forward_ios.svg" alt="">
        </button>
      </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', tpl);

        const viewer   = document.getElementById('dtiViewer');
        const imgEl    = document.getElementById('dtiViewerImg');
        const captEl   = document.getElementById('dtiViewerCaption');
        const btnClose  = document.getElementById('dtiViewerClose');
        const btnPrev   = document.getElementById('dtiViewerPrev');
        const btnNext   = document.getElementById('dtiViewerNext');
        const btnExpand = document.getElementById('dtiViewerExpand');

        let items = [];
        let idx   = 0;
        let lastFocused = null;

        // -------- Affichage --------
        function show(i) {
            const item = items[i];
            if (!item) return;
            idx = i;
            imgEl.classList.add('is-fading');
            const onLoad = () => {
                requestAnimationFrame(() => requestAnimationFrame(() => imgEl.classList.remove('is-fading')));
                captEl.textContent = item.caption || '';
            };
            imgEl.addEventListener('load', onLoad, { once: true });
            imgEl.src = item.src;
            imgEl.alt = item.caption || '';
            if (imgEl.complete) onLoad();
            const multi = items.length > 1;
            btnPrev.hidden = !multi;
            btnNext.hidden = !multi;
        }

        // -------- Ouverture / Fermeture --------
        function open(list, i) {
            items = list;
            lastFocused = document.activeElement;
            show(i);
            viewer.classList.add('is-open');
            viewer.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            // Le reste de la page devient inerte : le curseur virtuel des lecteurs
            // d'écran ne peut plus se promener derrière le dialogue
            document.querySelectorAll('main, nav, footer').forEach(el => { el.inert = true; });
            btnClose.focus({ preventScroll: true });
        }

        function close() {
            viewer.classList.remove('is-open', 'is-expanded');
            viewer.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            document.querySelectorAll('main, nav, footer').forEach(el => { el.inert = false; });
            imgEl.removeAttribute('src');
            lastFocused?.focus({ preventScroll: true });
        }

        // -------- Agrandir --------
        function toggleExpand() {
            const expanded = viewer.classList.toggle('is-expanded');
            btnExpand.classList.toggle('is-active', expanded);
            btnExpand.setAttribute('aria-label', expanded ? 'Réduire' : 'Agrandir');
        }

        // -------- Listeners --------
        btnClose.addEventListener('click', close);
        btnPrev.addEventListener('click', () => show((idx - 1 + items.length) % items.length));
        btnNext.addEventListener('click', () => show((idx + 1) % items.length));
        btnExpand.addEventListener('click', toggleExpand);
        viewer.addEventListener('click', (e) => { if (e.target === viewer) close(); });

        // Double-clic / double-tap sur l'image pour agrandir
        imgEl.addEventListener('dblclick', toggleExpand);
        let lastTap = 0;
        imgEl.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) { toggleExpand(); e.preventDefault(); }
            lastTap = now;
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (!viewer.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') show((idx + 1) % items.length);
            if (e.key === 'ArrowLeft')  show((idx - 1 + items.length) % items.length);
            if (e.key?.toLowerCase() === 'f') toggleExpand();

            // Focus trap : Tab reste à l'intérieur du dialogue
            if (e.key === 'Tab') {
                const focusables = Array.from(viewer.querySelectorAll('button:not([hidden])'));
                if (!focusables.length) return;
                const first = focusables[0];
                const last  = focusables[focusables.length - 1];
                if (!viewer.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        // Swipe tactile
        let tx = 0;
        viewer.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
        viewer.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - tx;
            if (Math.abs(dx) > 50) dx < 0
                ? show((idx + 1) % items.length)
                : show((idx - 1 + items.length) % items.length);
        }, { passive: true });

        // --- Galeries lightbox (groupées automatiquement par data-gallery) ---
        // Tout lien .lightbox-link[data-gallery="xxx"] est relié aux autres du même groupe :
        // aucun JS à ajouter pour un nouvel event, l'attribut suffit.
        const lightboxGroups = {};
        document.querySelectorAll('.lightbox-link[data-gallery]').forEach(a => {
            const g = a.dataset.gallery;
            (lightboxGroups[g] = lightboxGroups[g] || []).push(a);
        });
        Object.values(lightboxGroups).forEach(links => {
            const list = links.map(a => ({
                src:     a.getAttribute('href'),
                caption: a.dataset.caption || ''
            }));
            links.forEach((link, i) => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    open(list, i);
                });
            });
        });

        // --- Baguettectober 2025 ---
        // Desktop : le viewer plein écran, dessin par dessin.
        // Mobile (≤ 768 px) : un panneau qui monte du bas avec tous les dessins de la
        // semaine et le pseudo de chaque artiste ; un tap sur un dessin ouvre le viewer.
        const MOBILE_MQ = window.matchMedia('(max-width: 768px)');
        const weekCards = Array.from(document.querySelectorAll('#baguettectober-2025 .gallery-item[data-week]'))
            .filter(card => (GALLERIES.baguettectober2025?.[card.getAttribute('data-week')] || []).length);

        weekCards.forEach(card => {
            const week = card.getAttribute('data-week');
            const list = GALLERIES.baguettectober2025[week];
            // Le clic vient du <button class="gallery-trigger"> et remonte jusqu'ici ;
            // Entrée/Espace déclenchent un clic natif, pas besoin de keydown maison.
            card.addEventListener('click', () => {
                if (MOBILE_MQ.matches) openSheet(card);
                else open(list, 0);
            });
        });

        // -------- Panneau semaine (mobile) --------
        let sheet = null, sheetCard = null, sheetLastFocus = null;

        function ensureSheet() {
            if (sheet) return sheet;
            sheet = document.createElement('div');
            sheet.className = 'bgal-sheet';
            sheet.setAttribute('role', 'dialog');
            sheet.setAttribute('aria-modal', 'true');
            sheet.setAttribute('aria-labelledby', 'bgalSheetTitle');
            sheet.innerHTML =
                '<div class="bgal-sheet__panel">' +
                  '<div class="bgal-sheet__handle" aria-hidden="true"></div>' +
                  '<div class="bgal-sheet__head">' +
                    '<div class="bgal-sheet__meta">' +
                      '<p class="bgal-sheet__label" id="bgalSheetLabel"></p>' +
                      '<h3 class="bgal-sheet__title" id="bgalSheetTitle"></h3>' +
                      '<p class="bgal-sheet__desc" id="bgalSheetDesc"></p>' +
                    '</div>' +
                    '<button type="button" class="bgal-sheet__close" aria-label="Fermer">✕</button>' +
                  '</div>' +
                  '<div class="bgal-sheet__grid" id="bgalSheetGrid"></div>' +
                  '<div class="bgal-sheet__nav">' +
                    '<button type="button" class="bgal-sheet__prev"></button>' +
                    '<button type="button" class="bgal-sheet__next"></button>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(sheet);

            sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
            sheet.querySelector('.bgal-sheet__close').addEventListener('click', closeSheet);
            sheet.querySelector('.bgal-sheet__prev').addEventListener('click', () => stepSheet(-1));
            sheet.querySelector('.bgal-sheet__next').addEventListener('click', () => stepSheet(1));
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && sheet.classList.contains('is-open') && !viewer.classList.contains('is-open')) closeSheet();
            });
            return sheet;
        }

        function weekLabel(card) {
            return (card.querySelector('.gallery-week-label')?.textContent || '').trim();
        }

        function renderSheet(card) {
            sheetCard = card;
            const week = card.getAttribute('data-week');
            const list = GALLERIES.baguettectober2025[week];
            // fluent-emoji.js a remplacé l'emoji par une image : on relit son alt
            const iconEl = card.querySelector('.gallery-icon');
            const icon = (iconEl?.querySelector('img')?.alt || iconEl?.textContent || '').trim();

            sheet.querySelector('#bgalSheetLabel').textContent = `${weekLabel(card)} · ${icon}`;
            sheet.querySelector('#bgalSheetTitle').textContent = (card.querySelector('.gallery-week')?.textContent || '').trim();
            sheet.querySelector('#bgalSheetDesc').textContent  = (card.querySelector('.gallery-artist')?.textContent || '').trim();

            const grid = sheet.querySelector('#bgalSheetGrid');
            grid.innerHTML = '';
            list.forEach((item, i) => {
                const fig = document.createElement('figure');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'bgal-sheet__thumb';
                btn.setAttribute('aria-label', `Voir en grand : ${item.caption || 'dessin'}`);
                const img = document.createElement('img');
                img.src = item.src.replace(/^(img\/[^/]+)\//, '$1/thumbs/');
                img.alt = `${(item.caption || '').replace('Auteur : ', 'Dessin de ')} — Baguettectober 2025`;
                img.loading = 'lazy';
                img.decoding = 'async';
                img.width = 400;
                img.height = 400;
                img.addEventListener('error', () => { img.src = item.src; }, { once: true });
                btn.appendChild(img);
                btn.addEventListener('click', () => open(list, i));
                const cap = document.createElement('figcaption');
                cap.textContent = (item.caption || '').replace('Auteur : ', '');
                fig.append(btn, cap);
                grid.appendChild(fig);
            });
            grid.scrollTop = 0;

            const i = weekCards.indexOf(card);
            const prev = weekCards[i - 1], next = weekCards[i + 1];
            const btnPrev = sheet.querySelector('.bgal-sheet__prev');
            const btnNext = sheet.querySelector('.bgal-sheet__next');
            btnPrev.hidden = !prev;
            btnNext.hidden = !next;
            if (prev) btnPrev.textContent = `← ${weekLabel(prev)}`;
            if (next) btnNext.textContent = `${weekLabel(next)} →`;
        }

        function openSheet(card) {
            ensureSheet();
            sheetLastFocus = document.activeElement;
            renderSheet(card);
            sheet.classList.add('is-open');
            document.body.classList.add('bgal-open');
            sheet.querySelector('.bgal-sheet__close').focus({ preventScroll: true });
        }

        function stepSheet(dir) {
            const i = weekCards.indexOf(sheetCard);
            const target = weekCards[i + dir];
            if (target) renderSheet(target);
        }

        function closeSheet() {
            if (!sheet) return;
            sheet.classList.remove('is-open');
            document.body.classList.remove('bgal-open');
            sheetLastFocus?.focus({ preventScroll: true });
        }

    })();

    // --------------------------
    // Bandes de photos (DTI en mobile) : glisser à la souris
    // --------------------------
    // Au doigt, la bande défile nativement. À la souris (fenêtre étroite, trackpad
    // absent), un div sans barre visible ne bouge pas : on traduit le cliquer-glisser
    // en défilement, et on avale le clic qui suivrait pour ne pas ouvrir la lightbox.
    document.querySelectorAll('.dti-photo-grid').forEach(strip => {
        let down = false, moved = false, startX = 0, startLeft = 0, pending = 0, raf = 0, settle = 0;

        // Fin du glissement : on laisse la bande se poser en douceur sur la photo la
        // plus proche, puis on rend la main à l'accroche CSS (sinon elle sautait sec).
        const end = () => {
            if (!down) return;
            down = false;
            strip.classList.remove('is-grabbing');
            if (raf) { cancelAnimationFrame(raf); raf = 0; strip.scrollLeft = pending; }
            if (!moved) { strip.style.scrollSnapType = ''; return; }
            const padLeft  = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
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
            strip.style.scrollSnapType = 'none'; // pas d'accroche pendant qu'on tire
            strip.classList.add('is-grabbing');
        });
        strip.addEventListener('pointermove', (e) => {
            if (!down) return;
            const dx = e.clientX - startX;
            if (!moved && Math.abs(dx) > 4) {
                moved = true;
                // Capturé seulement une fois le glissement engagé : capturer dès l'appui
                // déroutait le clic vers la bande et la photo ne s'ouvrait plus en grand.
                strip.setPointerCapture(e.pointerId);
            }
            if (!moved) return;
            pending = startLeft - dx;
            if (!raf) raf = requestAnimationFrame(() => { strip.scrollLeft = pending; raf = 0; }); // une écriture par image
        });
        strip.addEventListener('pointerup', end);
        strip.addEventListener('pointercancel', end);
        strip.addEventListener('dragstart', (e) => e.preventDefault()); // pas de drag natif des images
        strip.addEventListener('click', (e) => {
            if (!moved) return;
            e.preventDefault();
            e.stopPropagation();
            moved = false;
        }, true);
    });

    // --------------------------
    // Génération des mosaïques
    // --------------------------
    document.querySelectorAll('.gallery-item[data-week]').forEach(card => {
        const weekKey     = card.dataset.week;
        const placeholder = card.querySelector('.gallery-placeholder');

        // Détecte l'édition via le parent (ex: #baguettectober-2025 → clé baguettectober2025)
        const section   = card.closest('section[id^="baguettectober-"]');
        const eventType = section ? section.id.replaceAll('-', '') : 'baguettectober2025';
        const list      = GALLERIES[eventType]?.[weekKey];

        if (list && list.length > 0) {
            const mosaic = document.createElement('div');
            mosaic.className = 'gallery-mosaic';

            const mosaicInner = document.createElement('div');
            mosaicInner.className = 'gallery-mosaic-inner';

            // Vraies <img> (indexables, avec alt) sur miniatures légères :
            // img/baguettectober/w1/x.webp → img/baguettectober/thumbs/w1/x.webp
            list.slice(0, 4).forEach(item => {
                const img = document.createElement('img');
                img.src = item.src.replace(/^(img\/[^/]+)\//, '$1/thumbs/');
                img.alt = `${(item.caption || '').replace('Auteur : ', 'Dessin de ')} — Baguettectober 2025`;
                img.loading = 'lazy';
                img.decoding = 'async';
                img.width = 400;
                img.height = 400;
                // Si la miniature manque (nouvelle édition ?), on retombe sur l'original
                img.addEventListener('error', () => { img.src = item.src; }, { once: true });
                mosaicInner.appendChild(img);
            });

            mosaic.appendChild(mosaicInner);
            // Le placeholder (emoji + « Semaine N ») reste dans le DOM : masqué sur desktop
            // par .is-replaced, il redevient l'en-tête de la carte en mobile.
            placeholder.classList.add('is-replaced');
            placeholder.insertAdjacentElement('afterend', mosaic);
            card.classList.add('has-gallery');
        } else {
            card.classList.add('no-gallery');
        }
    });
});
