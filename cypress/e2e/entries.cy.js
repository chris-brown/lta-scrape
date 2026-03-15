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

      // Find the entries table (has "Player" header), not "Online entries" (has "Name" header)
      let targetTable = null;
      tables.each((_, table) => {
        const headerText = table.querySelector("tr")?.innerText || "";
        if (headerText.includes("Player")) {
          targetTable = table;
        }
      });

      // Fall back to "Online entries" table if no "Entries" table
      if (!targetTable) {
        tables.each((_, table) => {
          const headerText = table.querySelector("tr")?.innerText || "";
          if (headerText.includes("Name")) {
            targetTable = table;
          }
        });
      }

      if (targetTable) {
        const headerText = targetTable.querySelector("tr")?.innerText || "";
        const isEntriesTable = headerText.includes("Player");

        const rows = targetTable.querySelectorAll("tr");
        rows.forEach((tr, i) => {
          if (i === 0) return;
          const cells = tr.querySelectorAll("td");
          if (cells.length < 2) return;

          let player;
          if (isEntriesTable) {
            player = cells[1].innerText.trim();
          } else {
            player = cells[0].innerText.trim();
          }

          if (player) {
            csvContent.push(
              `"${name}","${tournamentId}","${label}","${player}"`
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

  const buildRankingsLookup = (csv) => {
    const lookup = {};
    const lines = csv.split("\n");
    // Skip 2 header rows
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const fields = lines[i].split(",");
      const player = (fields[3] || "").trim().toLowerCase();
      if (!player) continue;
      lookup[player] = {
        rank: fields[0] || "",
        wtnsingles: fields[7] || "",
        form: fields[14] || "",
      };
    }
    return lookup;
  };

  it("scrapes entry lists for tournaments closing within 7 days", () => {
    const csvContent = [];
    let rankings = {};

    cy.readFile("files/combined.csv").then((csv) => {
      rankings = buildRankingsLookup(csv);
      cy.log(`Loaded ${Object.keys(rankings).length} players from rankings`);
    });

    cy.readFile("files/tournaments.csv").then((csv) => {
      const closingSoon = parseTournamentsCSV(csv);
      cy.log(`Found ${closingSoon.length} tournaments closing within 7 days`);
      processTournament(closingSoon, 0, csvContent);
    });

    cy.then(() => {
      // Enrich entries with ranking data
      const enriched = csvContent.map((row) => {
        // Parse player name from the row (4th field)
        const fields = [];
        let current = "";
        let inQuotes = false;
        for (let j = 0; j < row.length; j++) {
          if (row[j] === '"') {
            inQuotes = !inQuotes;
          } else if (row[j] === "," && !inQuotes) {
            fields.push(current);
            current = "";
          } else {
            current += row[j];
          }
        }
        fields.push(current);

        const player = (fields[3] || "").trim().toLowerCase();
        const data = rankings[player] || {};
        return `${row},"${data.rank || ""}","${data.wtnsingles || ""}","${data.form || ""}"`;
      });

      const headers =
        '"tournament","tournament_id","event","player","rank","wtnsingles","form"';
      cy.writeFile("files/entries.csv", [headers, ...enriched].join("\n"));
    });
  });
});
