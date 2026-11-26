(() => {
  const { escapeHtml, safeImageUrl } = SiteSecurity;
  // Fetch and render research topics
  fetch("data/research.json")
    .then((response) => response.json())
    .then((research) => {
      const container = document.getElementById("research-list");
      // Clear container in case of re-render
      container.innerHTML = "";
      research.forEach(({ title, contents, keywords, image }) => {
        const card = document.createElement("div");
        card.className =
          "p-6 bg-white rounded-lg shadow-md flex flex-col gap-4 items-center";
        card.innerHTML = `
              <img src="${escapeHtml(safeImageUrl(image))}" alt="${escapeHtml(title)}" class="w-48 h-48 object-cover rounded mt-2 border border-gray-200 bg-gray-100 flex-shrink-0">
              <div class="flex-1">
                <h3 class="text-lg font-semibold mb-2">${escapeHtml(title)}</h3>
                <p class="text-sm">${escapeHtml(contents)}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  ${keywords
                    .map(
                      (kw) =>
                        `<span class='bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded'>${escapeHtml(kw)}</span>`,
                    )
                    .join("")}
                </div>
              </div>
            `;
        const imageElement = card.querySelector("img");
        if (imageElement.getAttribute("src")) {
          imageElement.addEventListener("error", () => {
            imageElement.hidden = true;
          });
        } else {
          imageElement.remove();
        }
        container.appendChild(card);
      });
    });
})();
