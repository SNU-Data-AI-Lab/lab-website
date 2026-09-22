// include-header.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("header.html", { cache: "no-cache" })
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("site-header").innerHTML = html;

      // Highlight current page link in both desktop and mobile nav
      const current = location.pathname.split("/").pop();
      document.querySelectorAll("#main-nav a").forEach((link) => {
        if (link.getAttribute("href") === current) {
          link.classList.add("font-bold");
          link.classList.remove("hover:text-neutral-300");
        } else {
          link.classList.remove("font-bold");
          link.classList.add("hover:text-neutral-300");
        }
      });
      document.querySelectorAll("#nav-menu a").forEach((link) => {
        if (link.getAttribute("href") === current) {
          link.classList.add("font-bold");
        } else {
          link.classList.remove("font-bold");
        }
      });

      // Re-bind navigation toggle after dynamic load
      const toggleButton = document.getElementById("nav-toggle");
      const menu = document.getElementById("nav-menu");

      if (toggleButton && menu) {
        toggleButton.addEventListener("click", () => {
          menu.classList.toggle("hidden");
        });
      }
    })
    .catch((error) => {
      console.error("Error loading header:", error);
    });
});

// include-header.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("footer.html")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("site-footer").innerHTML = html;
    })
    .catch((error) => {
      console.error("Error loading footer:", error);
    });
});
