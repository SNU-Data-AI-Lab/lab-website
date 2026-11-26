(() => {
  const { escapeHtml, safeWebUrl, safeImageUrl, safeEmailUrl } = SiteSecurity;
  fetch("data/postdoctoral_researchers.json", { cache: "no-cache" })
    .then((response) => response.json())
    .then((postdoctoral_researchers) => {
      const container = document.getElementById("postdoctoral_researchers");
      postdoctoral_researchers.forEach(
        ({ name, role, image, research, email, homepage }) => {
          const card = document.createElement("div");
          card.className =
            "bg-white shadow-md rounded-lg p-4 sm:p-6 text-center";
          card.innerHTML = `
              <img src="${escapeHtml(safeImageUrl(image))}" alt="${escapeHtml(name)}" class="sm:w-36 sm:h-36 mb-2 mx-auto object-cover">
              <div class="flex items-center justify-center gap-1">
                <h3 class="text-sm sm:text-lg font-semibold">${escapeHtml(name)}</h3>
                ${
                  safeWebUrl(homepage)
                    ? `<a href="${escapeHtml(safeWebUrl(homepage))}" class="text-neutral-500 hover:text-neutral-800 transition" target="_blank" rel="noopener noreferrer">
                      <svg xmlns="https://www.w3.org/2000/svg" x="0px" y="0px" width="18" height="18" viewBox="0 0 48 48" fill="currentColor" class="w-4 h-4">
                        <path d="M39.5,43h-9c-1.381,0-2.5-1.119-2.5-2.5v-9c0-1.105-0.895-2-2-2h-4c-1.105,0-2,0.895-2,2v9c0,1.381-1.119,2.5-2.5,2.5h-9	C7.119,43,6,41.881,6,40.5V21.413c0-2.299,1.054-4.471,2.859-5.893L23.071,4.321c0.545-0.428,1.313-0.428,1.857,0L39.142,15.52	C40.947,16.942,42,19.113,42,21.411V40.5C42,41.881,40.881,43,39.5,43z"></path>
                      </svg></a>`
                    : ""
                }
              </div>
              <p class="text-xs sm:text-sm text-gray-600">${escapeHtml(role)}</p>
              <p class="hidden sm:block mt-2 text-xs">${escapeHtml(research)}</p>
              <a
                  href="${escapeHtml(safeEmailUrl(email))}"
                  class="hidden sm:block underline mt-1 text-xs text-blue-500 hover:text-blue-800"
                  >${escapeHtml(email)}</a
                >
            `;
          card
            .querySelectorAll('[src=""], [href=""]')
            .forEach((element) => element.remove());
          container.appendChild(card);
        },
      );
    });
  fetch("data/graduate_students.json", { cache: "no-cache" })
    .then((response) => response.json())
    .then((graduate_students) => {
      const container = document.getElementById("graduate_students");
      graduate_students.forEach(
        ({ name, role, image, research, email, homepage }) => {
          const card = document.createElement("div");
          card.className =
            "bg-white shadow-md rounded-lg p-4 sm:p-6 text-center";
          card.innerHTML = `
              <img src="${escapeHtml(safeImageUrl(image))}" alt="${escapeHtml(name)}" class="sm:w-36 sm:h-36 mb-2 mx-auto object-cover">
              <div class="flex items-center justify-center gap-1">
                <h3 class="text-sm sm:text-lg font-semibold">${escapeHtml(name)}</h3>
                ${
                  safeWebUrl(homepage)
                    ? `<a href="${escapeHtml(safeWebUrl(homepage))}" class="text-neutral-500 hover:text-neutral-800 transition" target="_blank" rel="noopener noreferrer">
                      <svg xmlns="https://www.w3.org/2000/svg" x="0px" y="0px" width="18" height="18" viewBox="0 0 48 48" fill="currentColor" class="w-4 h-4">
                        <path d="M39.5,43h-9c-1.381,0-2.5-1.119-2.5-2.5v-9c0-1.105-0.895-2-2-2h-4c-1.105,0-2,0.895-2,2v9c0,1.381-1.119,2.5-2.5,2.5h-9	C7.119,43,6,41.881,6,40.5V21.413c0-2.299,1.054-4.471,2.859-5.893L23.071,4.321c0.545-0.428,1.313-0.428,1.857,0L39.142,15.52	C40.947,16.942,42,19.113,42,21.411V40.5C42,41.881,40.881,43,39.5,43z"></path>
                      </svg></a>`
                    : ""
                }
              </div>
              <p class="text-xs sm:text-sm text-gray-600">${escapeHtml(role)}</p>
              <p class="hidden sm:block mt-2 text-xs">${escapeHtml(research)}</p>
              <a
                  href="${escapeHtml(safeEmailUrl(email))}"
                  class="hidden sm:block underline mt-1 text-xs text-blue-500 hover:text-blue-800"
                  >${escapeHtml(email)}</a
                >
            `;
          card
            .querySelectorAll('[src=""], [href=""]')
            .forEach((element) => element.remove());
          container.appendChild(card);
        },
      );
    });
  fetch("data/undergraduate_interns.json", { cache: "no-cache" })
    .then((response) => response.json())
    .then((undergraduate_interns) => {
      const container = document.getElementById("undergraduate_interns");
      undergraduate_interns.forEach(({ name, association }) => {
        const card = document.createElement("div");
        card.className = "bg-white shadow-md rounded-lg p-2 sm:p-4 text-center";
        card.innerHTML = `
              <h3 class="text-sm sm:text-base font-semibold">${escapeHtml(name)}</h3>
              <p class="text-xs sm:text-sm text-gray-600">${escapeHtml(association)}</p>
            `;
        card
          .querySelectorAll('[src=""], [href=""]')
          .forEach((element) => element.remove());
        container.appendChild(card);
      });
    });
  fetch("data/alumni.json", { cache: "no-cache" })
    .then((response) => response.json())
    .then((alumni) => {
      const setupAccordion = (button, list, arrow) => {
        button.setAttribute("aria-controls", list.id);
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", () => {
          list.classList.toggle("hidden");
          button.setAttribute(
            "aria-expanded",
            String(!list.classList.contains("hidden")),
          );
          arrow.classList.toggle("rotate-90");
        });
      };

      const renderAlumniDirectory = (container, entries, countBadge) => {
        container.innerHTML = "";
        countBadge.textContent = `${entries.length}`;

        entries.forEach(({ name, association }) => {
          const item = document.createElement("div");
          item.className = "alumni-directory-row";
          item.innerHTML = `
                <span class="alumni-directory-name">${escapeHtml(name)}</span>
                <span class="alumni-directory-association">${escapeHtml(association)}</span>
              `;
          container.appendChild(item);
        });
      };

      // Postdoctoral alumni
      const postdocBtn = document.getElementById("toggle-postdoctoral-alumni");
      const postdocList = document.getElementById("postdoctoral-alumni-list");
      const postdocArrow = document.getElementById("postdoctoral-arrow");
      const postdocCount = document.getElementById("postdoctoral-alumni-count");
      const postdocEntries = alumni.postdoctoral_researchers || [];
      setupAccordion(postdocBtn, postdocList, postdocArrow);
      renderAlumniDirectory(postdocList, postdocEntries, postdocCount);
      if (postdocEntries.length === 0) {
        postdocList.textContent = "No postdoctoral alumni listed yet.";
      }

      // Graduate alumni
      const gradBtn = document.getElementById("toggle-graduate-alumni");
      const gradList = document.getElementById("graduate-alumni-list");
      const gradArrow = document.getElementById("graduate-arrow");
      const gradCount = document.getElementById("graduate-alumni-count");
      setupAccordion(gradBtn, gradList, gradArrow);
      renderAlumniDirectory(gradList, alumni.graduate_students, gradCount);

      // Undergraduate alumni
      const undergradBtn = document.getElementById(
        "toggle-undergraduate-alumni",
      );
      const undergradList = document.getElementById(
        "undergraduate-alumni-list",
      );
      const undergradArrow = document.getElementById("undergraduate-arrow");
      const undergradCount = document.getElementById(
        "undergraduate-alumni-count",
      );
      setupAccordion(undergradBtn, undergradList, undergradArrow);
      renderAlumniDirectory(
        undergradList,
        alumni.undergraduate_interns,
        undergradCount,
      );
    });
})();
