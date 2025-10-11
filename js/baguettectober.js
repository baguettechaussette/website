document.addEventListener('DOMContentLoaded', () => {
    // --------------------------
    // Données de ta galerie
    // --------------------------
    const BAGUETTECTOBER_GALLERY = {
        w1: [
            {src: 'img/baguettectober/w1/baguette.jpg', caption: 'Auteur : Baguette Chaussette'},
            {src: 'img/baguettectober/w1/barbouy.png', caption: 'Auteur : Barbouy'},
            {src: 'img/baguettectober/w1/bunny.jpg', caption: 'Auteur : Bunny / Madi'},
            {src: 'img/baguettectober/w1/CalypsoRaven.jpg', caption: 'Auteur : CalypsoRaven'},
            {src: 'img/baguettectober/w1/hiimaxou.jpg', caption: 'Auteur : Hiimaxou'},
            {src: 'img/baguettectober/w1/lydais.jpg', caption: 'Auteur : Lydaïs'},
            {src: 'img/baguettectober/w1/Maximepr.jpg', caption: 'Auteur : Maximepr'},
        ],
        w2: [],
        w3: [],
        w4: [],
        bonus: []
    };

    // --------------------------
    // Template de la lightbox
    // --------------------------
    (function setupLightbox() {
        const tpl = `
    <div class="lightbox" id="bcLightbox" aria-modal="true" role="dialog" aria-label="Galerie">
      <div class="lightbox__inner">
        <div class="lightbox__stage">
          <button class="lightbox__btn lightbox__prev" aria-label="Précédent">‹</button>
          <img class="lightbox__img" id="bcLightboxImg" alt="">
          <button class="lightbox__btn lightbox__next" aria-label="Suivant">›</button>

          <button class="lightbox__close" id="bcLightboxClose" aria-label="Fermer">✕</button>
          <button class="lightbox__play" id="bcLightboxPlay" aria-label="Lecture/Pause">▶</button>
          <button class="lightbox__fullscreen" id="bcLightboxFull" aria-label="Plein écran">⛶</button>
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
        const btnFull = document.getElementById('bcLightboxFull');

        let currentList = [];
        let currentIndex = 0;
        let slideTimer = null;
        let isPlaying = false;
        const SLIDE_INTERVAL = 4000; // ms

        // -------- Helpers --------
        function setActiveThumb(i) {
            thumbsEl.querySelectorAll('.lightbox__thumb').forEach((t, idx) => {
                t.classList.toggle('is-active', idx === i);
            });
        }

        function fadeToImage(newIndex) {
            const item = currentList[newIndex];
            if (!item) return;

            // 1) lance le fade-out de l'image actuelle
            imgEl.classList.add('is-fading'); // -> opacity: 0 (transition)

            // 2) quand la nouvelle image est prête...
            const onLoad = () => {
                imgEl.removeEventListener('load', onLoad);

                // ...laisse au navigateur le temps d'appliquer le style,
                // puis enlève la classe sur la frame suivante pour déclencher le fade-in.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        imgEl.classList.remove('is-fading'); // -> opacity: 1 (transition)
                    });
                });

                captionEl.textContent = item.caption || '';
                setActiveThumb(newIndex);
            };

            imgEl.addEventListener('load', onLoad, { once: true });

            // 3) change la source APRÈS avoir mis is-fading (sinon ça clignote)
            imgEl.alt = item.caption || '';
            imgEl.src = item.src;
        }


        function buildThumbs() {
            thumbsEl.innerHTML = '';
            currentList.forEach((item, i) => {
                const t = document.createElement('button');
                t.className = 'lightbox__thumb';
                t.setAttribute('aria-label', `Ouvrir image ${i + 1}`);
                t.innerHTML = `<img src="${item.src}" alt="">`;
                t.addEventListener('click', () => {
                    stopSlideshow(); // interaction utilisateur → on met en pause
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
            isPlaying = false;
            btnPlay.classList.remove('is-playing');
            btnPlay.textContent = '▶';
            clearInterval(slideTimer);
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

        // -------- Plein écran --------
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                lightbox.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        }

        document.addEventListener('fullscreenchange', () => {
            btnFull.classList.toggle('is-active', !!document.fullscreenElement);
        });

        // -------- Ouverture/Fermeture --------
        function openGallery(weekKey, start = 0) {
            currentList = BAGUETTECTOBER_GALLERY[weekKey] || [];
            if (!currentList.length) {
                console.warn(`Aucune image définie pour ${weekKey}`);
                return;
            }
            currentIndex = Math.max(0, Math.min(start, currentList.length - 1));
            buildThumbs();
            fadeToImage(currentIndex);
            lightbox.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            startSlideshow(); // diapo auto au démarrage
        }

        function closeGallery() {
            lightbox.classList.remove('is-open');
            document.body.style.overflow = '';
            imgEl.removeAttribute('src');
            stopSlideshow();
            if (document.fullscreenElement) document.exitFullscreen?.();
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
        btnFull.addEventListener('click', toggleFullscreen);

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
            if (e.key.toLowerCase() === 'f') toggleFullscreen();
            if (e.code === 'Space') {
                e.preventDefault();
                toggleSlideshow();
            }
        });

        // Ouvrir depuis les cartes
        document.querySelectorAll('.gallery-item[data-week]').forEach(card => {
            const week = card.getAttribute('data-week');
            // accessibilité clavier gérée par ailleurs (Enter/Space)
            card.addEventListener('click', () => openGallery(week, 0));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openGallery(week, 0);
                }
            });
        });
    })();
});
