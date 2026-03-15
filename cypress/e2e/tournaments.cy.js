describe("Scrape LTA tournaments", () => {
  // Filter ID mappings (discovered from LTA form DOM)
  const AGE_GROUPS = {
    "12U": { index: 4, id: "12" },
    "14U": { index: 5, id: "14" },
    "16U": { index: 6, id: "16" },
  };

  const GRADES = {
    1: { index: 0, id: "1" },
    2: { index: 1, id: "2" },
    3: { index: 2, id: "3" },
    4: { index: 3, id: "4" },
    5: { index: 4, id: "5" },
  };

  const GAME_TYPES = {
    "Girls Singles": { index: 1, id: "2" },
    "Girls Doubles": { index: 3, id: "4" },
  };

  const SEARCHES = [
    { ageGroup: "12U", grades: [1, 2, 3] },
    { ageGroup: "14U", grades: [1, 2, 3, 4, 5] },
    { ageGroup: "16U", grades: [1, 2, 3, 4, 5] },
  ];

  const POSTCODE = Cypress.env("POSTCODE") || "SET_POSTCODE_ENV_VAR";

  const buildSearchUrl = (ageGroup, grades, page = 1) => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 3);

    const startDate = today.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    const params = new URLSearchParams();
    params.set("DateFilterType", "0");
    params.set("StartDate", startDate);
    params.set("EndDate", endDateStr);
    params.set("LocationFilterType", "0");
    params.set("PostalCode", POSTCODE);
    params.set("StatusFilterID", "2");
    params.set("Distance", "500");

    for (let i = 0; i < 7; i++) {
      const match = Object.values(GAME_TYPES).find((g) => g.index === i);
      params.set(`EventGameTypeIDList[${i}]`, match ? match.id : "false");
    }

    for (let i = 0; i < 22; i++) {
      const ag = AGE_GROUPS[ageGroup];
      params.set(`AgeGroupIDList[${i}]`, i === ag.index ? ag.id : "false");
    }

    for (let i = 0; i < 8; i++) {
      const match = grades.map((g) => GRADES[g]).find((g) => g.index === i);
      params.set(`GradingIDList[${i}]`, match ? match.id : "false");
    }

    params.set("page", String(page));
    return `https://competitions.lta.org.uk/find?${params.toString()}`;
  };

  const acceptCookies = () => {
    cy.get("body").then(($body) => {
      if ($body.find('button:contains("Accept")').length) {
        cy.contains("Accept").click();
      }
    });
  };

  const extractResultsFromPage = (ageGroup, csvContent) => {
    cy.get("ul#searchResultArea > li.list__item").each(($li) => {
      const href = $li.find("a.media__img").first().prop("href");
      if (!href) return;

      const name = $li.find("h4.media__title span.nav-link__value").first().text().trim();
      if (!name) return;

      const venueText = $li.find("small.media__subheading span.nav-link__value").first().text().trim();
      const distance = venueText.match(/\((\d+\.?\d*)\s*miles?\)/)?.[1] || "";
      const venue = venueText.split("|")[0].replace(/\(\d+\.?\d*\s*miles?\)/, "").trim();

      const startDate = $li.find("time").first().attr("datetime")?.split(" ")[0] || "";

      const gradeTag = $li.find("span.tag--soft").filter((_, el) => el.innerText.trim().startsWith("Grade")).first().text().trim();

      csvContent.push(
        `"${name}","${venue}","${ageGroup}","${gradeTag}","${startDate}","${distance}","${href}"`
      );
    });
  };

  const collectAllPages = (ageGroup, csvContent) => {
    extractResultsFromPage(ageGroup, csvContent);

    cy.get("body").then(($body) => {
      if ($body.find('a[title="Next"]').length) {
        cy.get('a[title="Next"]').click();
        cy.get("ul#searchResultArea").should("be.visible");
        collectAllPages(ageGroup, csvContent);
      }
    });
  };

  it("scrapes all tournaments", () => {
    const csvContent = [];

    SEARCHES.forEach(({ ageGroup, grades }) => {
      const url = buildSearchUrl(ageGroup, grades);
      cy.visit(url);
      acceptCookies();

      cy.get("h3")
        .contains(/^\d+\sResults?$/)
        .should("be.visible")
        .invoke("text")
        .then((text) => {
          const count = parseInt(text);
          if (count === 0) return;
          collectAllPages(ageGroup, csvContent);
        });
    });

    cy.then(() => {
      const headers = '"name","venue","age_group","grade","start_date","distance_miles","url"';
      cy.writeFile("files/tournaments.csv", [headers, ...csvContent].join("\n"));
    });
  });
});
