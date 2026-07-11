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
        <button class="dti-viewer__expand" id="dtiViewerExpand" aria-label="Agrandir">
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
            btnClose.focus({ preventScroll: true });
        }

        function close() {
            viewer.classList.remove('is-open', 'is-expanded');
            viewer.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
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
        document.querySelectorAll('#baguettectober-2025 .gallery-item[data-week]').forEach(card => {
            const week = card.getAttribute('data-week');
            const list = GALLERIES.baguettectober2025?.[week] || [];
            if (!list.length) return;
            card.addEventListener('click', () => open(list, 0));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(list, 0);
                }
            });
        });

    })();

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
            placeholder.replaceWith(mosaic);
            card.classList.add('has-gallery');
        } else {
            card.classList.add('no-gallery');
        }
    });
});
