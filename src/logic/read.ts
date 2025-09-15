import readXlsxFile, { type Row } from "read-excel-file/web-worker";

export async function parseEnfants(file: Blob): [ContraintesEnfants, string] {
  const rows = await readXlsxFile(file);
  const title = rows[0][0];
  if (typeof title != "string") {
    return [{}, "Type invalide pour l'entête du document."];
  }
  const { month, year } = parseMonth(title);
  let firstDay: Date;
  for (const row of rows) {
    if (typeof row[0] == "string" && row[0].trim() == "Enfant") {
      // read the starting day
      const day = row[2];
      if (typeof day != "string") {
        return [{}, "Type invalide pour le premier jour du tableau."];
      }
      firstDay = parseDay(month, year, day);
      continue;
    }
    if (typeof row[0] == "string" && row[0].includes("/")) {
      // we have a child
      parseChild(row);
    }
  }
}

const months = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

function parseMonth(s: string): { month: number; year: number } {
  let line = s.split("\n").filter(s => s.includes("Mois de"))[0];
  line = line.substring(7).trim();
  const [monthS, yearS] = line.split(" ");
  const month = months.indexOf(monthS.toLowerCase().trim());
  const year = Number(yearS);
  return { month, year };
}

function parseDay(month: number, year: number, s: string): Date {
  // l 01
  const day = Number(s.trim().substring(1).trim());
  return new Date(year, month, day);
}

function parseChild(row: Row) {
  const child = (row[0] as string).trim();
  const date = child.substring(child.length - 10);
  console.log(date);
}
