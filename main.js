// Simple tab switching between Journal / Learning / Resources
const navLinks = document.querySelectorAll(".nav-link");
const panels = document.querySelectorAll(".panel");

function showSection(id) {
  panels.forEach((p) => p.classList.remove("panel-active"));
  navLinks.forEach((n) => n.classList.remove("active"));

  const targetPanel = document.getElementById(id);
  const targetLink = document.querySelector(`.nav-link[data-section="${id}"]`);

  if (targetPanel && targetLink) {
    targetPanel.classList.add("panel-active");
    targetLink.classList.add("active");
  }
}

// click handlers
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const section = link.dataset.section;
    showSection(section);
    // update URL hash without scrolling
    window.history.replaceState(null, "", `#${section}`);
  });
});

// load correct panel based on hash
const initialHash = window.location.hash.replace("#", "");
if (initialHash) {
  showSection(initialHash);
}

// footer year
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
