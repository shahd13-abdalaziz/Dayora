const themeBtn = document.querySelector('.theme-btn');
const themeIcon = themeBtn ? themeBtn.querySelector('i') : null;
const themeText = themeBtn ? themeBtn.querySelector('span') : null;

function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);

    if (themeText) {
        themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    if (themeIcon) {
        themeIcon.classList.toggle('fa-sun', isDark);
        themeIcon.classList.toggle('fa-moon', !isDark);
    }
}

const savedTheme = localStorage.getItem('theme') === 'dark';
applyTheme(savedTheme);

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
    });
}