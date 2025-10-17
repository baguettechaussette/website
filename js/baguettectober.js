document.addEventListener('DOMContentLoaded', () => {
    // --------------------------
    // Données de ta galerie
    // --------------------------
    const BAGUETTECTOBER_GALLERY = {
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
        w3: [],
        w4: [],
        bonus: []
    };

    // --------------------------
    // Template de la lightbox
    // --------------------------
    (function setupLightbox() {
        const tpl = `
    <div class="lightbox" id="bcLightbox" aria-modal="true" role="dialog" aria-label="Galerie" aria-hidden="true">
      <div class="lightbox__inner">
        <div class="lightbox__stage">
          <button type="button" class="lightbox__btn lightbox__prev" aria-label="Précédent">‹</button>
          <img class="lightbox__img" id="bcLightboxImg" alt="">
          <button type="button" class="lightbox__btn lightbox__next" aria-label="Suivant">›</button>

          <button type="button" class="lightbox__close" id="bcLightboxClose" aria-label="Fermer">✕</button>
          <button type="button" class="lightbox__play" id="bcLightboxPlay" aria-label="Lecture/Pause">▶</button>
          <button type="button" class="lightbox__zoom" id="bcLightboxZoom" aria-label="Zoom">⛶</button>
        </div>
        <div class="lightbox__thumbs" id="bcLightboxThumbs" aria-label="Vignettes"></div>
        <div class="lightbox__caption" id="bcLightboxCaption"></div>
      </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', tpl);
    })();

    // --------------------------
    // Logique de la galerie
    // --------------------------
    (function initGallery() {
        const lightbox = document.getElementById('bcLightbox');
        const imgEl = document.getElementById('bcLightboxImg');
        const captionEl = document.getElementById('bcLightboxCaption');
        const thumbsEl = document.getElementById('bcLightboxThumbs');
        const btnPrev = lightbox.querySelector('.lightbox__prev');
        const btnNext = lightbox.querySelector('.lightbox__next');
        const btnClose = document.getElementById('bcLightboxClose');
        const btnPlay = document.getElementById('bcLightboxPlay');
        const btnZoom = document.getElementById('bcLightboxZoom');

        let currentList = [];
        let currentIndex = 0;
        let slideTimer = null;
        let isPlaying = false;
        const SLIDE_INTERVAL = 4000; // ms

        // focus management
        let lastFocused = null;

        // -------- Helpers --------
        function setActiveThumb(i) {
            thumbsEl.querySelectorAll('.lightbox__thumb').forEach((t, idx) => {
                t.classList.toggle('is-active', idx === i);
            });
        }

        function fadeToImage(newIndex) {
            const item = currentList[newIndex];
            if (!item) return;

            // 1) lancer le fade-out
            imgEl.classList.add('is-fading');

            // 2) prép callback avec gestion du cache
            let handled = false;
            const onLoad = () => {
                if (handled) return;
                handled = true;
                imgEl.removeEventListener('load', onLoad);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        imgEl.classList.remove('is-fading'); // fade-in
                    });
                });

                captionEl.textContent = item.caption || '';
                setActiveThumb(newIndex);
            };

            imgEl.addEventListener('load', onLoad, { once: true });

            // 3) alt + src
            imgEl.alt = item.caption || '';
            imgEl.src = item.src;

            // 4) si l'image est déjà en cache et 'complete'
            if (imgEl.complete) onLoad();
        }

        function buildThumbs() {
            thumbsEl.innerHTML = '';
            currentList.forEach((item, i) => {
                const t = document.createElement('button');
                t.type = 'button';
                t.className = 'lightbox__thumb';
                t.setAttribute('aria-label', `Ouvrir image ${i + 1}`);
                t.innerHTML = `<img src="${item.src}" alt="" loading="lazy">`;
                t.addEventListener('click', () => {
                    stopSlideshow(); // interaction → pause
                    currentIndex = i;
                    fadeToImage(currentIndex);
                });
                thumbsEl.appendChild(t);
            });
        }

        // -------- Diapo --------
        function startSlideshow() {
            if (isPlaying) return;
            isPlaying = true;
            btnPlay.classList.add('is-playing');
            btnPlay.textContent = '⏸';
            slideTimer = setInterval(next, SLIDE_INTERVAL);
        }

        function stopSlideshow() {
            if (!isPlaying) return;
            isPlaying = false;
            btnPlay.classList.remove('is-playing');
            btnPlay.textContent = '▶';
            if (slideTimer) {
                clearInterval(slideTimer);
                slideTimer = null;
            }
        }

        function toggleSlideshow() {
            isPlaying ? stopSlideshow() : startSlideshow();
        }

        // -------- Navigation --------
        function next() {
            if (!currentList.length) return;
            currentIndex = (currentIndex + 1) % currentList.length;
            fadeToImage(currentIndex);
        }

        function prev() {
            if (!currentList.length) return;
            currentIndex = (currentIndex - 1 + currentList.length) % currentList.length;
            fadeToImage(currentIndex);
        }

        // -------- Zoom (agrandir la lightbox) --------
        function toggleZoom() {
            lightbox.classList.toggle('is-zoomed');
            btnZoom.classList.toggle('is-active', lightbox.classList.contains('is-zoomed'));
        }

        // -------- Ouverture/Fermeture --------
        function openGallery(weekKey, start = 0) {
            currentList = BAGUETTECTOBER_GALLERY[weekKey] || [];
            if (!currentList.length) {
                console.warn(`Aucune image définie pour ${weekKey}`);
                return;
            }
            lastFocused = document.activeElement;
            currentIndex = Math.max(0, Math.min(start, currentList.length - 1));
            buildThumbs();
            fadeToImage(currentIndex);
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            btnClose.focus({ preventScroll: true });
            startSlideshow(); // diapo auto
        }

        function closeGallery() {
            lightbox.classList.remove('is-open');
            lightbox.classList.remove('is-zoomed');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            imgEl.removeAttribute('src');
            stopSlideshow();
            if (document.fullscreenElement) document.exitFullscreen?.();
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus({ preventScroll: true });
            }
        }

        // -------- Listeners UI --------
        btnNext.addEventListener('click', () => {
            stopSlideshow();
            next();
        });
        btnPrev.addEventListener('click', () => {
            stopSlideshow();
            prev();
        });
        btnClose.addEventListener('click', closeGallery);
        btnPlay.addEventListener('click', toggleSlideshow);
        btnZoom.addEventListener('click', toggleZoom);

        // Fermer en cliquant le fond
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeGallery();
        });

        // Clavier
        window.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('is-open')) return;
            if (e.key === 'Escape') closeGallery();
            if (e.key === 'ArrowRight') {
                stopSlideshow();
                next();
            }
            if (e.key === 'ArrowLeft') {
                stopSlideshow();
                prev();
            }
            if (e.key && e.key.toLowerCase() === 'z') toggleZoom(); // Zoom
            // Optionnel : vrai plein écran navigateur
            if (e.key && e.key.toLowerCase() === 'f') {
                if (!document.fullscreenElement) lightbox.requestFullscreen?.();
                else document.exitFullscreen?.();
            }
            if (e.code === 'Space') {
                e.preventDefault();
                toggleSlideshow();
            }
        });

        // Ouvrir depuis les cartes
        document.querySelectorAll('.gallery-item[data-week]').forEach(card => {
            const week = card.getAttribute('data-week');
            card.addEventListener('click', () => openGallery(week, 0));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openGallery(week, 0);
                }
            });
        });
    })();

    document.querySelectorAll('.gallery-item[data-week]').forEach(card => {
        const weekKey = card.dataset.week;
        const list = BAGUETTECTOBER_GALLERY[weekKey];
        const placeholder = card.querySelector('.gallery-placeholder');

        if (list && list.length > 0) {
            // Crée une mosaïque avec jusqu’à 4 images
            const imgs = list.slice(0, 4).map(i => i.src);
            const mosaic = document.createElement('div');
            mosaic.className = 'gallery-mosaic';
            mosaic.innerHTML = imgs.map(src => `<div style="background-image:url('${src}')"></div>`).join('');
            placeholder.replaceWith(mosaic);

            // Marque la carte comme “active”
            card.classList.add('has-gallery');
        } else {
            // Marque la carte comme vide
            card.classList.add('no-gallery');
        }
    });

});
