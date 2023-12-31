describe("Scrape LTA website", () => {

  const writeToFile = title => (csvContent) => {
      cy.writeFile(
        `files/${title}.csv`,
        ["player,id,year,county,form,tournaments", ...csvContent].join("\n")
      );
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
              if(page < maxPage) return checkButtonAndLoop();
            });
        } else {
          return;
        }
      });
    };

    return checkButtonAndLoop().then(() => csvContent);
  }

  it("u9", () => {
    cy.visit(
      "https://competitions.lta.org.uk/ranking/ranking.aspx?rid=303"
    );
    cy.contains("Accept").click();
    cy.contains('a', '9U Girls').click();
    cy.get('select#_pagesize').select('100');

    const csvContent = [];
    let page = 1;
    const maxPage = 7;

    scrape(csvContent, page, maxPage).then(writeToFile('u9'));
  });

  it("u10", () => {
    cy.visit(
      "https://competitions.lta.org.uk/ranking/ranking.aspx?rid=303"
    );
    cy.contains("Accept").click();
    cy.contains('a', '10U Girls').click();
    cy.get('select#_pagesize').select('100');

    const csvContent = [];
    let page = 1;
    const maxPage = 7;

    scrape(csvContent, page, maxPage).then(writeToFile('u10'));
  });

  it("combined", () => {
    cy.visit(
      "https://competitions.lta.org.uk/ranking/ranking.aspx?rid=301"
    );
    cy.contains("Accept").click();
    cy.contains('a', '11U Girls').click();
    cy.get('select#_pagesize').select('100', { force: true });

    const csvContent = [];
    let page = 1;
    const maxPage = 6;

    const content = scrape(csvContent, page, maxPage);

    console.log('content', content)

    cy.visit(
      "https://competitions.lta.org.uk/ranking/ranking.aspx?rid=301"
    );

    cy.contains('a', '11U Boys').click();
    cy.get('select#_pagesize').select('100', { force: true });
    scrape(csvContent, page, maxPage).then(writeToFile('combined'));
  });
});
