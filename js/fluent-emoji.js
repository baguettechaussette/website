// Fluent Emoji Loader
(function () {
    'use strict';

    const EMOJI_MAP = {
        '🥖': '1f956',
        '🧦': '1f9e6',
        '🎥': '1f3a5',
        '📺': '1f4fa',
        '🎵': '1f3b5',
        '📸': '1f4f8',
        '💬': '1f4ac',
        '🐦': '1f426',
        '⏰': '23f0',
        '🌙': '1f319',
        '🔴': '1f534',
        // '🎮': '1f3ae',
        '📧': '1f4e7',
        '🤝': '1f91d',
        '✨': '2728',
        '❤️': '2764-fe0f',
        '💙': '1f499',
        '🎃': '1f383',
        '❄️': '2744-fe0f',
        '🫶': '1faf6',
        '😊': '1f60a',
        '⌛': '231b',
        '🎨': '1f3a8',
        '🖌️': '1f58c-fe0f',
        '🎭': '1f3ad',
        '🌟': '1f31f',
        '👉': '1f449',
        '🇯🇵': '1f1ef-1f1f5',
        '🏪': '1f3ea',
        '🌍': '1f30d',
        '🌿': '1f33f',
        '🧡': '1f9e1',
        '🏡': '1f3e1'
    };

    // https://registry.npmmirror.com/@lobehub/fluent-emoji-modern/latest/files/assets
    const CDN_BASE = '/img/emoji';
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
    let observer = null;

    // Motif de découpe construit une seule fois : les emojis les plus longs d'abord
    // (les séquences avec variation selector, ex. ❤️, doivent matcher avant leurs préfixes)
    const EMOJI_PATTERN = new RegExp(
        '(' + Object.keys(EMOJI_MAP)
            .sort((a, b) => b.length - a.length)
            .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|') + ')',
        'g'
    );

    function replaceEmojis(root) {
        root = root || document.body;

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                    if (parent.closest('[data-fluent-emoji-processed]')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToReplace = [];
        while (walker.nextNode()) {
            const text = walker.currentNode.textContent;
            for (const emoji in EMOJI_MAP) {
                if (text.includes(emoji)) {
                    nodesToReplace.push(walker.currentNode);
                    break;
                }
            }
        }

        nodesToReplace.forEach(node => {
            // Reconstruction en noeuds DOM purs, jamais via innerHTML : le texte peut
            // venir de contenus externes (titres de clips Twitch écrits par les viewers).
            const span = document.createElement('span');
            span.setAttribute('data-fluent-emoji-processed', '');

            node.textContent.split(EMOJI_PATTERN).forEach(part => {
                if (!part) return;
                const code = EMOJI_MAP[part];
                if (code) {
                    const img = document.createElement('img');
                    img.className = 'fluent-emoji';
                    img.src = `${CDN_BASE}/${code}.svg`;
                    img.alt = part;
                    span.appendChild(img);
                } else {
                    span.appendChild(document.createTextNode(part));
                }
            });

            node.parentNode.replaceChild(span, node);
        });
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        replaceEmojis(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        replaceEmojis();
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();