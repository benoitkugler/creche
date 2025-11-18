import Excel from "exceljs";

import {
  computeDate,
  emptyRange,
  formatHoraire,
  formatRange,
  isError,
  newError,
  parseHoraire,
  parseRange,
  rangeIncludes,
  rangeIsEmpty,
  readExcelFile,
  type Cell,
  type CellValue,
  type error,
  type int,
} from "./shared";
import type {
  WeekPro,
  WeekPros,
  HoraireTravail,
  Reunion,
  Pro,
  Range,
  ProsPlanning,
} from "./types";

export function emptyHoraireTravail(): HoraireTravail {
  return {
    presence: emptyRange(),
    pause: emptyRange(),
  };
}

export function formatHoraireTravail(h: HoraireTravail) {
  return `${formatRange(h.presence)} (pause: ${formatRange(h.pause)})`;
}

export async function parseExcelPros(
  file: Blob,
  firstMonday: Date
): Promise<ProsPlanning | error> {
  const rows = await readExcelFile(file);

  const out: ProsPlanning = { firstMonday, weeks: [] };
  let currentWeek: WeekPros = {
    week: -1,
    prosHoraires: [],
    roulement: -1,
    reunion: null,
  };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row.length) continue;

    // check for Reunion row
    const reunion = isReunionRow(row);
    if (isError(reunion)) return reunion;
    if (reunion != null && currentWeek.week != -1) {
      currentWeek.reunion = reunion;
      continue;
    }

    // detect a week start
    const firstCell = row[0].value;
    if (typeof firstCell != "string") continue;
    if (firstCell.toLowerCase().includes("semaine")) {
      const weekHeader = parseSemaine(firstCell, firstMonday);
      if (isError(weekHeader)) return weekHeader;

      // ignore previous weeks
      if (weekHeader.week < 0) {
        continue;
      }

      // flush the current week if any
      if (currentWeek.week != -1) {
        out.weeks.push(currentWeek);
      }
      currentWeek = {
        week: weekHeader.week,
        roulement: weekHeader.roulement,
        prosHoraires: [],
        reunion: null,
      }; // start a new week
    } else if (firstCell.trim().length != 0 && currentWeek.week != -1) {
      // this is a pro !
      // fetch the next line
      index += 1;
      if (index >= rows.length) return newError("Ligne de pauses manquantes.");
      const res = parseHorairesPros(row, rows[index]);
      if (isError(res)) return newError(`Ligne ${index + 1} : ${res.err}`);
      currentWeek.prosHoraires.push(res);
      // always skip next line to avoid errors
      index += 1;
    }
  }

  // flush the last week if any
  if (currentWeek.prosHoraires.length != 0) {
    out.weeks.push(currentWeek);
  }

  if (!out.weeks.length)
    return newError("Planning des pros invalide (ou vide).");

  return out;
}

function parseSemaine(
  firstCell: string,
  firstMonday: Date
): { week: int; roulement: int } | error {
  const reSemaine =
    /semaine\s*(\d+)\s*du\s*(\d+)(?:\/\d+)?\s*au\s*(\d+)\/(\d+)\/(\d+)/i;
  const match = reSemaine.exec(firstCell);
  if (match === null)
    return newError("Format de la cellule 'Semaine...' invalide.");
  const roulement = Number(match[1]) - 1; // normalize to 0 based
  const firstDay = Number(match[2]);
  const lastDay = Number(match[3]);
  const lastMonth = Number(match[4]) - 1;
  const lastYear = Number(match[5]);
  if (lastYear >= 1000) return newError("Date invalide.");
  const last = new Date(2000 + lastYear, lastMonth, lastDay);
  if (last.getDay() != 5)
    return newError("Dernier jour invalide (vendredi attendu).");
  const first = new Date(last.getTime());
  first.setDate(first.getDate() - 4);
  if (first.getDate() != firstDay) {
    return newError("Premier jour invalide.");
  }
  const week = Math.round(
    (first.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7)
  );

  return { week, roulement };
}

function parseHorairesPros(
  rowPresences: Cell[],
  rowPauses: Cell[]
): WeekPro | error {
  if (rowPresences.length < 15 || rowPauses.length < 15) {
    return newError("Ligne trop courte.");
  }

  const firstCell = rowPresences[0];
  const prenom = (firstCell.value as string).trim();
  const pro: Pro = { prenom, color: firstCell.color, isInterimaire: false };
  const d1 = parseHorairesDay(
    rowPresences[1],
    rowPresences[2],
    rowPauses[1],
    rowPauses[2]
  );
  if (isError(d1)) return d1;
  const d2 = parseHorairesDay(
    rowPresences[4],
    rowPresences[5],
    rowPauses[4],
    rowPauses[5]
  );
  if (isError(d2)) return d2;
  const d3 = parseHorairesDay(
    rowPresences[7],
    rowPresences[8],
    rowPauses[7],
    rowPauses[8]
  );
  if (isError(d3)) return d3;
  const d4 = parseHorairesDay(
    rowPresences[10],
    rowPresences[11],
    rowPauses[10],
    rowPauses[11]
  );
  if (isError(d4)) return d4;
  const d5 = parseHorairesDay(
    rowPresences[13],
    rowPresences[14],
    rowPauses[13],
    rowPauses[14]
  );
  if (isError(d5)) return d5;

  return {
    pro,
    horaires: [d1, d2, d3, d4, d5],
    detachement: null,
  };
}

function parseHorairesDay(
  presenceStart: Cell,
  presenceEnd: Cell,
  pauseStart: Cell,
  pauseEnd: Cell
): HoraireTravail | error {
  const presenceI = parseRangeOrEmpty(presenceStart.value, presenceEnd.value);
  if (isError(presenceI)) return presenceI;
  const pauseI = parseRangeOrEmpty(pauseStart.value, pauseEnd.value);
  if (isError(pauseI)) return pauseI;

  // check inclusion
  if (!rangeIncludes(presenceI, pauseI)) {
    return newError("Pause non comprise dans les horaires de travail.");
  }
  return { presence: presenceI, pause: pauseI };
}

function parseRangeOrEmpty(
  cellStart: CellValue,
  cellEnd: CellValue
): Range | error {
  if (cellStart instanceof Date) {
    cellStart = cellStart.toISOString().slice(11, 16);
  }
  if (cellEnd instanceof Date) {
    cellEnd = cellEnd.toISOString().slice(11, 16);
  }
  if (typeof cellStart != "string" || cellStart.length == 0) {
    return emptyRange();
  }
  if (typeof cellEnd != "string" || cellEnd.length == 0) {
    return emptyRange();
  }
  const range = `${cellStart} ${cellEnd}`;
  return parseRange(range);
}

function isReunionRow(row: Cell[]): Reunion | error | null {
  const reReunion = /R[é|e]union\s?(\d+)[h|:](\d+)/i;
  for (let index = 0; index < row.length; index++) {
    const cell = row[index].value;
    if (typeof cell != "string") continue;

    const match = reReunion.exec(cell);
    if (!match) continue;
    const horaire = parseHoraire(match[1], match[2]);
    if (isError(horaire)) return horaire;

    const day = Math.round((index - 1) / 3);
    return { day, horaire };
  }
  return null;
}

export async function writeExcelPros(planning: ProsPlanning, month: string) {
  const workbook = new Excel.Workbook();

  // Set Workbook Properties
  workbook.creator = "Appli Crèche";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Feuille 1");

  const setCenter = (r: number, c: number) =>
    (sheet.getCell(r, c).alignment = { horizontal: "center" });

  sheet.getColumn(1).width = 20;

  const columnCount = 17;
  sheet.addRow([`Planning du personnel - ${month}`]);
  setCenter(1, 1);
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.getRow(1).height = 25;
  sheet.getCell(1, 1).style.alignment!.vertical = "middle";
  sheet.getCell(1, 1).style.font = {
    bold: true,
    name: "Calibri",
  };
  sheet.addRow([]);

  for (const week of planning.weeks) {
    const monday = computeDate(planning.firstMonday, {
      week: week.week,
      day: 0,
    });
    const friday = computeDate(planning.firstMonday, {
      week: week.week,
      day: 4,
    });

    // title row
    const titleRow = sheet.addRow([
      `Semaine ${week.roulement + 1} du ${monday.getDate()}/${
        monday.getMonth() + 1
      } au ${friday.getDate()}/${friday.getMonth() + 1}/${
        friday.getFullYear() - 2000
      }`,
    ]);
    setCenter(titleRow.number, 1);
    sheet.getCell(titleRow.number, 1).style.font = {
      bold: true,
      name: "Calibri",
    };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, columnCount);

    // days row
    const daysRow = sheet.addRow([
      "",
      "Lundi",
      "",
      "",
      "Mardi",
      "",
      "",
      "Mercredi",
      "",
      "",
      "Jeudi",
      "",
      "",
      "Vendredi",
      "",
      "",
    ]);
    for (let index = 0; index < 5; index++) {
      const column = 2 + index * 3;
      sheet.mergeCells(daysRow.number, column, daysRow.number, column + 2);
      setCenter(daysRow.number, column);
      sheet.getCell(daysRow.number, column).style.font = {
        bold: true,
        name: "Calibri",
      };
    }

    const borderDark: Excel.Border = {
      style: "thin",
      color: { argb: "FF000000" },
    };

    // pro rows
    for (const pro of week.prosHoraires) {
      const color = pro.pro.color;
      const vals1 = [pro.pro.prenom];
      const vals2 = ["pauses"];
      for (const dayI of pro.horaires) {
        // duration
        if (rangeIsEmpty(dayI.presence)) {
          vals1.push("", "", "");
        } else {
          vals1.push(
            formatHoraire(dayI.presence.start),
            formatHoraire(dayI.presence.end),
            ""
          );
        }

        if (rangeIsEmpty(dayI.pause)) {
          vals2.push("", "", "");
        } else {
          vals2.push(
            formatHoraire(dayI.pause.start),
            formatHoraire(dayI.pause.end),
            ""
          );
        }
      }
      const row1 = sheet.addRow(vals1);
      const row2 = sheet.addRow(vals2);
      sheet.addRow([]);

      setCenter(row1.number, 1);
      setCenter(row2.number, 1);

      const dayDurationCells = [];
      for (let index = 0; index < 5; index++) {
        const column = 2 + index * 3;
        setCenter(row1.number, column);
        setCenter(row1.number, column + 1);
        setCenter(row2.number, column);
        setCenter(row2.number, column + 1);
        const cellStartPresence = sheet.getCell(row1.number, column);
        const cellEndPresence = sheet.getCell(row1.number, column + 1);
        const cellStartPause = sheet.getCell(row2.number, column);
        const cellEndPause = sheet.getCell(row2.number, column + 1);

        cellStartPresence.numFmt = "HH:MM";
        cellEndPresence.numFmt = "HH:MM";
        sheet.getCell(row1.number, column + 2).numFmt = "HH:MM";
        cellStartPause.numFmt = "HH:MM";
        cellEndPause.numFmt = "HH:MM";
        sheet.getCell(row2.number, column + 2).numFmt = "HH:MM";

        const formula = `${cellEndPresence.address} - ${cellStartPresence.address} - (${cellEndPause.address} - ${cellStartPause.address})`;

        const cellDuration = sheet.getCell(row1.number, column + 2);
        cellDuration.value = { formula };
        setCenter(row1.number, column + 2);
        cellDuration.style.alignment!.vertical = "middle";
        sheet.mergeCells(row1.number, column + 2, row2.number, column + 2);
        dayDurationCells.push(cellDuration.address);

        // borders
        cellStartPresence.border = { left: borderDark };
        cellStartPause.border = { left: borderDark };
        cellDuration.border = { right: borderDark };
      }
      // total for the week
      const totalCell = sheet.getCell(row1.number, columnCount);
      totalCell.numFmt = "[H]:MM:SS";
      totalCell.value = {
        formula: dayDurationCells.join(" + "),
      };
      sheet.mergeCells(row1.number, columnCount, row2.number, columnCount);
      setCenter(row1.number, columnCount);
      totalCell.style.alignment!.vertical = "middle";

      // colorize
      for (let index = 0; index < columnCount; index++) {
        if (!color) continue;
        const fill: Excel.Fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${color.substring(1)}` },
        };
        sheet.getCell(row1.number, index + 1).style.fill = fill;
        sheet.getCell(row2.number, index + 1).style.fill = fill;
        sheet.getCell(row1.number, index + 1).border = {
          top: borderDark,
          bottom: borderDark,
        };
        sheet.getCell(row2.number, index + 1).border = {
          top: borderDark,
          bottom: borderDark,
        };
      }
    }

    const lastRow = sheet.addRow([]);
    // optional reunion
    if (week.reunion) {
      const cell = sheet.getCell(lastRow.number, 2 + week.reunion.day * 3);
      cell.value = `Réunion ${formatHoraire(week.reunion.horaire)}`;
      sheet.mergeCells(
        cell.fullAddress.row,
        cell.fullAddress.col,
        cell.fullAddress.row,
        cell.fullAddress.col + 1
      );
      setCenter(cell.fullAddress.row, cell.fullAddress.col);
      cell.style.font = {
        bold: true,
        name: "Calibri",
        color: { argb: "FFFF0000" },
      };
      sheet.addRow([]);
    }
  }

  // write to a new buffer
  const out: ArrayBuffer = await workbook.xlsx.writeBuffer();
  return out;
}
