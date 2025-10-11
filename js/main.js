// Toggle mobile menu
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
            document.getElementById('navLinks').classList.remove('active');
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Inject followers count
fetch('data/followers.json', {cache: 'no-store'})
    .then(r => r.json())
    .then(({followers}) => {
        const el = document.getElementById('followersCount');
        if (el && Number.isFinite(followers))
            el.textContent = followers.toLocaleString('fr-FR');
    })
    .catch(err => console.warn('Followers count unavailable:', err.message));
