// Fluent Emoji Loader
(function () {
    'use strict';

    const EMOJI_MAP = {
        '🥖': '1f956', '🧦': '1f9e6', '🎥': '1f3a5', '📺': '1f4fa',
        '🎵': '1f3b5', '📸': '1f4f8', '💬': '1f4ac', '🐦': '1f426',
        '⏰': '23f0', '🌙': '1f319', '🔴': '1f534', '🎮': '1f3ae',
        '📧': '1f4e7', '🤝': '1f91d', '✨': '2728', '❤️': '2764-fe0f',
        '💙': '1f499', '🎃': '1f383', '❄️': '2744-fe0f', '🫶': '1faf6',
        '😊': '1f60a', '⌛': '231b', '🎨': '1f3a8', '🖌️': '1f58c-fe0f', '🎭': '1f3ad', '🌟': '1f31f', '👉': '1f449'
    };

    const CDN_BASE = 'https://registry.npmmirror.com/@lobehub/fluent-emoji-modern/latest/files/assets';

    function replaceEmojis() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    // Skip script tags
                    if (node.parentElement.tagName === 'SCRIPT') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToReplace = [];
        while (walker.nextNode()) {
            const text = walker.currentNode.textContent;
            let hasEmoji = false;

            for (const emoji in EMOJI_MAP) {
                if (text.includes(emoji)) {
                    hasEmoji = true;
                    break;
                }
            }

            if (hasEmoji) {
                nodesToReplace.push(walker.currentNode);
            }
        }

        nodesToReplace.forEach(node => {
            let html = node.textContent;

            for (const [emoji, code] of Object.entries(EMOJI_MAP)) {
                const imgTag = `<img class="fluent-emoji" src="${CDN_BASE}/${code}.svg" alt="${emoji}" loading="lazy" />`;
                html = html.split(emoji).join(imgTag);
            }

            const span = document.createElement('span');
            span.innerHTML = html;
            node.parentNode.replaceChild(span, node);
        });
    }

    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceEmojis);
    } else {
        replaceEmojis();
    }
})();