describe("Scrape LTA tournament entry lists", () => {
  const TARGET_EVENTS = ["12U GS", "14U GS", "16U GS"];

  const parseTournamentsCSV = (csv) => {
    const lines = csv.split("\n");
    const seen = new Set();
    const closingSoon = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const fields = [];
      let current = "";
      let inQuotes = false;
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '"') {
          inQuotes = !inQuotes;
        } else if (line[j] === "," && !inQuotes) {
          fields.push(current);
          current = "";
        } else {
          current += line[j];
        }
      }
      fields.push(current);

      const name = fields[0] || "";
      const entryCloses = fields[6] || "";
      const url = fields[8] || "";

      const match = entryCloses.match(/^(\d+)([dh])$/);
      if (!match) continue;
      const daysLeft =
        match[2] === "d" ? parseInt(match[1]) : parseInt(match[1]) / 24;
      if (daysLeft > 7) continue;

      const idMatch = url.match(/[?&]id=([^&]+)/i);
      if (!idMatch) continue;
      const tournamentId = idMatch[1];

      if (seen.has(tournamentId)) continue;
      seen.add(tournamentId);
      closingSoon.push({ name, tournamentId });
    }

    return closingSoon;
  };

  const scrapeEventPage = (name, tournamentId, eventLinks, index, csvContent) => {
    if (index >= eventLinks.length) return;

    const { label, href } = eventLinks[index];
    cy.visit(href);

    cy.get("body").then(($eventBody) => {
      const tables = $eventBody.find("table");
      if (tables.length > 0) {
        const rows = tables.first().find("tr");
        rows.each((i, tr) => {
          if (i === 0) return;
          const cells = tr.querySelectorAll("td");
          if (cells.length < 2) return;

          const status = cells[0].innerText.trim();
          const player = cells[1].innerText.trim();
          const seed = cells.length > 3 ? cells[3].innerText.trim() : "";

          if (player) {
            csvContent.push(
              `"${name}","${tournamentId}","${label}","${player}","${status}","${seed}"`
            );
          }
        });
      }

      scrapeEventPage(name, tournamentId, eventLinks, index + 1, csvContent);
    });
  };

  const processTournament = (tournaments, index, csvContent) => {
    if (index >= tournaments.length) return;

    const { name, tournamentId } = tournaments[index];
    cy.visit(
      `https://competitions.lta.org.uk/sport/events.aspx?id=${tournamentId}`
    );

    cy.get("body").then(($body) => {
      if ($body.find('button:contains("Accept")').length) {
        cy.contains("Accept").click();
      }

      const eventLinks = [];
      $body.find("a").each((_, el) => {
        const text = el.innerText.trim();
        if (TARGET_EVENTS.includes(text)) {
          eventLinks.push({ label: text, href: el.href });
        }
      });

      if (eventLinks.length > 0) {
        scrapeEventPage(name, tournamentId, eventLinks, 0, csvContent);
      }

      cy.then(() => {
        processTournament(tournaments, index + 1, csvContent);
      });
    });
  };

  it("scrapes entry lists for tournaments closing within 7 days", () => {
    const csvContent = [];

    cy.readFile("files/tournaments.csv").then((csv) => {
      const closingSoon = parseTournamentsCSV(csv);
      cy.log(`Found ${closingSoon.length} tournaments closing within 7 days`);
      processTournament(closingSoon, 0, csvContent);
    });

    cy.then(() => {
      const headers =
        '"tournament","tournament_id","event","player","status","seed"';
      cy.writeFile("files/entries.csv", [headers, ...csvContent].join("\n"));
    });
  });
});
