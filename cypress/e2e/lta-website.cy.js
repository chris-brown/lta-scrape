describe("Scrape LTA website", () => {
  const writeToFile =
    (title, headers = "player,id,year,county,form,tournaments") =>
    (csvContent) => {
      cy.writeFile(`files/${title}.csv`, [headers, ...csvContent].join("\n"));
    };

  const scrape = (csvContent, page, maxPage) => {
    const checkButtonAndLoop = () => {
      return cy.get('a[title="Next"]').then(($button) => {
        cy.contains(`Page ${page}`).should("be.visible");
        if ($button.length > 0) {
          cy.get("tr")
            .each(($tr, index) => {
              if (index !== 0 && index < 101) {
                const rowElement = $tr.get(0);
                var cellResult = Object.values(rowElement.cells)
                  .map((item) => item.innerText.trim())
                  .join(",");

                csvContent.push(cellResult);
              }
            })
            .then(() => {
              page++;
              cy.get('a[title="Next"]', { force: true }).click();
              if (page < maxPage) return checkButtonAndLoop();
            });
        } else {
          return;
        }
      });
    };

    return checkButtonAndLoop().then(() => csvContent);
  };

  it("u9", () => {
    cy.visit("https://competitions.lta.org.uk/ranking/ranking.aspx?rid=303");
    cy.contains("Accept").click();
    cy.contains("a", "9U Girls").click();
    cy.get("select#_pagesize").select("100");

    const csvContent = [];
    let page = 1;
    const maxPage = 4;

    scrape(csvContent, page, maxPage).then(writeToFile("u9"));
  });

  it("u10", () => {
    cy.visit("https://competitions.lta.org.uk/ranking/ranking.aspx?rid=303");
    cy.contains("Accept").click();
    cy.contains("a", "10U Girls").click();
    cy.get("select#_pagesize").select("100");

    const csvContent = [];
    let page = 1;
    const maxPage = 4;

    scrape(csvContent, page, maxPage).then(writeToFile("u10"));
  });

  it("combined", () => {
    cy.visit("https://competitions.lta.org.uk/ranking/ranking.aspx?rid=301");
    cy.contains("Accept").click();
    cy.contains("a", "11U Girls").click();
    cy.get("select#_pagesize").select("100", { force: true });

    const csvContent = [];
    let page = 1;

    const content = scrape(csvContent, page, 4);

    console.log("content", content);

    cy.visit("https://competitions.lta.org.uk/ranking/ranking.aspx?rid=301");

    cy.contains("a", "11U Boys").click();
    cy.get("select#_pagesize").select("100", { force: true });
    scrape(csvContent, page, 5).then(
      writeToFile(
        "combined",
        "rank,rank_up,empty,player,id,year,county,singles,doubles,tournaments,tournamentsused,form"
      )
    );
  });
});
