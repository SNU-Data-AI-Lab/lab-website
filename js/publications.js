(() => {
  const { safeWebUrl } = SiteSecurity;
  let currentView = "papers";
  let papersData = null;
  let tutorialsData = null;

  // Load both datasets
  Promise.all([
    fetch("data/publications.json").then((res) => res.json()),
    fetch("data/tutorials.json").then((res) => res.json()),
  ])
    .then(([papers, tutorials]) => {
      papersData = papers;
      tutorialsData = tutorials;
      renderContent(currentView);
    })
    .catch((error) => {
      console.error("Error loading data:", error);
    });

  // Tab switching functionality
  document.getElementById("papers-tab").addEventListener("click", () => {
    switchTab("papers");
  });

  document.getElementById("tutorials-tab").addEventListener("click", () => {
    switchTab("tutorials");
  });

  function switchTab(view) {
    currentView = view;

    // Update tab styles
    document.querySelectorAll(".tab-button").forEach((tab) => {
      tab.classList.remove("active", "font-semibold");
      tab.classList.add("border-transparent", "text-gray-500", "font-medium");
    });

    const activeTab = document.getElementById(`${view}-tab`);
    activeTab.classList.add("active", "font-semibold");
    activeTab.classList.remove(
      "border-transparent",
      "text-gray-500",
      "font-medium",
    );
    renderContent(view);
  }

  function renderContent(view) {
    const data = view === "papers" ? papersData : tutorialsData;
    if (!data) return;

    const container = document.getElementById("content-list");
    container.innerHTML = ""; // Clear existing content
    let currentYear = null;

    data.forEach((item) => {
      if (item.year !== currentYear) {
        const yearHeader = document.createElement("h3");
        yearHeader.textContent = item.year;
        yearHeader.className =
          "text-xl sm:text-2xl font-semibold mt-2 sm:mt-4 pt-4 sm:pt-8";
        container.appendChild(yearHeader);
        currentYear = item.year;
      }

      const itemElement = document.createElement("div");
      itemElement.className =
        "bg-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow";

      const title = document.createElement("div");
      title.className = "font-semibold text-sm sm:text-lg sm:mb-1";
      title.textContent = item.title;

      const authors = document.createElement("div");
      authors.className = "text-sm sm:text-base text-gray-700 sm:mb-1";

      // Create authors list with lab member highlighting
      item.authors.forEach((author, index) => {
        if (index) authors.appendChild(document.createTextNode(", "));
        const authorElement = document.createElement("span");
        authorElement.textContent = author;
        if (item.is_lab_member && item.is_lab_member[index]) {
          authorElement.className = "underline font-semibold";
        }
        authors.appendChild(authorElement);
      });

      const venue = document.createElement("div");
      venue.className =
        "text-xs sm:text-sm italic text-gray-500 inline-block font-semibold mr-2";
      venue.textContent = item.venue;

      const links = document.createElement("span");
      links.className = "text-xs sm:text-sm inline-block";

      // Create array of link elements
      const linkElements = [];
      const allowedLinks =
        view === "papers"
          ? ["paper", "code", "web"]
          : ["paper", "code", "web", "video", "slides"];

      for (const [label, href] of Object.entries(item.links)) {
        const safeHref = safeWebUrl(href);
        if (safeHref && allowedLinks.includes(label)) {
          const a = document.createElement("a");
          a.href = safeHref;
          a.className = "text-blue-600 hover:underline";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = label;
          linkElements.push(a);
        }
      }

      // Wrap links in brackets with commas
      if (linkElements.length > 0) {
        links.appendChild(document.createTextNode("["));
        linkElements.forEach((link, index) => {
          links.appendChild(link);
          if (index < linkElements.length - 1) {
            links.appendChild(document.createTextNode(", "));
          }
        });
        links.appendChild(document.createTextNode("]"));
      }

      const venueLinksWrapper = document.createElement("div");
      venueLinksWrapper.appendChild(venue);
      venueLinksWrapper.appendChild(links);

      itemElement.appendChild(title);
      itemElement.appendChild(authors);
      itemElement.appendChild(venueLinksWrapper);
      container.appendChild(itemElement);
    });
  }
})();
