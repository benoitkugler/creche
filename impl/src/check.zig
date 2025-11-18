const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");

pub const Diagnostic = struct {
    dayIndex: sh.DayIndex,
    horaireIndex: sh.TimeIndex,
    horaire: sh.Horaire,
    message: Message,

    const Message = struct {
        title: sh.string,
        message: sh.string,
    };

    fn deinit(self: *Diagnostic, gpa: Allocator) void {
        gpa.free(self.message.message);
    }

    pub fn buildSlice(gpa: Allocator, checks: []const TimeCheck) ![]Diagnostic {
        var out = try gpa.alloc(Diagnostic, checks.len);
        for (checks, 0..) |ch, i| {
            const message = try ch.check.format(gpa);
            out[i] = .{
                .dayIndex = ch.dayIndex,
                .horaireIndex = ch.horaireIndex,
                .horaire = sh.indexToHoraire(ch.horaireIndex),
                .message = message,
            };
        }
        return out;
    }
};

pub const TimeCheck = struct {
    dayIndex: sh.DayIndex,
    horaireIndex: sh.TimeIndex,
    check: Check,
};

const Check = union(enum) {
    missingProForEnfants: ChildrenCountCheck,
    invalidPause: PauseCheck,
    missingProAtReunion: MissingProAtReunion,
    wrongAdaptationHoraire: WrongAdaptationHoraire,
    notEnoughSleep: NotEnoughSleep,
    wrongDepartArriveePro: WrongDepartArriveePro,
    wrongRoulement: WrongRoulement,

    pub fn format(self: Check, gpa: Allocator) !Diagnostic.Message {
        var w = std.Io.Writer.Allocating.init(gpa);
        defer w.deinit();
        var title: sh.string = "";
        switch (self) {
            .missingProForEnfants => |val| {
                title = "Nombre d'enfants";
                try w.writer.print("Pro. manquante pour le nombre d'enfants (requises: {}, présentes: {}, adaptations: {}).", .{ val.expectedProsCount, val.gotProsCount, val.adaptationCount });
            },
            .invalidPause => |val| {
                switch (val) {
                    .missing => |pause| {
                        title = "Pause manquante";
                        try w.writer.print("Pause manquante pour {s}", .{pause.pro.prenom});
                    },
                    .wrongDuration => |pause| {
                        title = "Durée de la pause";
                        try w.writer.print("Durée de la pause ({} min.) invalide pour {s} ({s}).", .{ pause.got, pause.pro.prenom, pause.reason });
                    },
                    .wrongHoraire => |pause| {
                        title = "Horaires de la pause";
                        try w.writer.print(
                            "Horaires de la pause invalides pour {s} (de {s} à {s}).",
                            .{ pause.pro.prenom, pause.got.start.format(), pause.got.end.format() },
                        );
                    },
                }
            },
            .missingProAtReunion => |val| {
                title = "Réunion hebdomadaire";
                if (val.missingCount == 1) {
                    try w.writer.print("Pro. manquante sur le créneau de réunion : {s}.", .{val.missing.prenom});
                } else {
                    try w.writer.print("{} pros manquantes sur le créneau de réunion ({s}, ...).", .{ val.missingCount, val.missing.prenom });
                }
            },
            .notEnoughSleep => |val| {
                title = "Temps de repos";
                try w.writer.print(
                    "Temps de repos insuffisant pour {s} : reprise le lendemain à {s} au lieu de {s}",
                    .{ val.pro.prenom, val.gotLendemain.format(), val.expectedLendemain.format() },
                );
            },
            .wrongDepartArriveePro => |val| {
                title = "Départ ou arrivée d'une pro.";
                switch (val.moment) {
                    .firstArrival => {
                        try w.writer.print(
                            "Arrivée de la première pro à {s} (au lieu de {s})",
                            .{ val.got.format(), val.expected.format() },
                        );
                    },
                    .secondArrival => {
                        try w.writer.print(
                            "Arrivée de la deuxième pro à {s} (au lieu de {s})",
                            .{ val.got.format(), val.expected.format() },
                        );
                    },
                    .beforeLastGo => {
                        try w.writer.print(
                            "Départ de l'avant dernière pro à {s} (au lieu de {s})",
                            .{ val.got.format(), val.expected.format() },
                        );
                    },
                    .lastGo => {
                        try w.writer.print(
                            "Départ de la dernière pro à {s} (au lieu de {s})",
                            .{ val.got.format(), val.expected.format() },
                        );
                    },
                }
            },
            .wrongAdaptationHoraire => |val| {
                title = "Horaires d'une adaptation";
                try w.writer.print(
                    "Horaires d'adaptation invalides (de {s} à {s})",
                    .{ val.got.start.format(), val.got.end.format() },
                );
            },
            .wrongRoulement => |val| {
                title = "Roulement";
                const got = try std.mem.join(gpa, " / ", &val.gotOrder);
                const expected = try std.mem.join(gpa, " / ", &val.expectedOrder);
                try w.writer.print("Roulement invalide : {s} au lieu de {s}", .{ got, expected });
            },
        }

        return .{ .title = title, .message = try w.toOwnedSlice() };
    }
};

test "compile" {
    const gpa = std.testing.allocator;
    const ch = Check{ .wrongAdaptationHoraire = .{ .got = sh.Range.empty() } };
    const s = try ch.format(gpa);
    defer gpa.free(s.message);

    const l = try Diagnostic.buildSlice(gpa, &[_]TimeCheck{
        .{ .dayIndex = .{}, .horaireIndex = 0, .check = ch },
        .{ .dayIndex = .{}, .horaireIndex = 0, .check = ch },
    });
    defer gpa.free(l);
    defer l[0].deinit(gpa);
    defer l[1].deinit(gpa);
}

// `check` analyze les données fournies et s'assure notamment qu'il y a
// suffisament de pros à tout moment de la journée.
//
// La liste renvoyée est vide si et seulement si aucun problème n'est détecté.
pub fn checkPlanning(gpa: Allocator, children: sh.ChildrenPlanning, pros: sh.ProsPlanning, roulements: ?sh.Roulements) ![]TimeCheck {
    const normalizedChildren = buildChildrenCount(gpa, children);
    const normalizedPros = buildProsCount(gpa, pros);
    defer gpa.free(normalizedChildren);
    defer gpa.free(normalizedPros);

    var out = try std.ArrayList(TimeCheck).initCapacity(gpa, 0);

    for (pros.weeks) |weekRaw| {
        const weekI = weekRaw.week;
        const week = normalizedPros[weekI];

        const reunionRange = if (weekRaw.reunion) |reu| reu.range() else null;

        for (week, 0..) |dayPros, dayI| {
            const dayChildren = normalizedChildren[weekI][dayI];
            const dayIndex = sh.DayIndex{ .week = weekI, .day = @intCast(dayI) };

            const diag = checkChildrenCountDay(dayChildren, dayPros, reunionRange);
            if (diag) |val| {
                try out.append(gpa, .{ .dayIndex = dayIndex, .horaireIndex = val.horaire, .check = .{ .missingProForEnfants = val.check } });
            }

            // Arrivée et départ
            var prosHoraires = try gpa.alloc(sh.Range, weekRaw.prosHoraires.len);
            for (weekRaw.prosHoraires, 0..) |value, i| {
                prosHoraires[i] = value.horaires[dayI].presence;
            }

            const l = checkProsArrivals(&dayChildren, prosHoraires);
            for (l.slice()) |c| {
                try out.append(gpa, .{
                    .dayIndex = dayIndex,
                    .horaireIndex = sh.horaireToIndex(c.got),
                    .check = .{ .wrongDepartArriveePro = c },
                });
            }

            gpa.free(prosHoraires);
        }
    }

    // Adaptation 2
    for (children.children) |child| {
        for (child.creneaux, 0..) |week, weekI| {
            for (week, 0..) |maybeDay, dayI| {
                const day = maybeDay orelse continue;
                if (!day.isAdaptation) continue;

                const c = checkAdaptationHoraires(day.horaires);
                if (c) |val| {
                    try out.append(gpa, .{
                        .dayIndex = .{ .week = weekI, .day = @intCast(dayI) },
                        .horaireIndex = sh.horaireToIndex(val.got.start),
                        .check = .{ .wrongAdaptationHoraire = val },
                    });
                }
            }
        }
    }

    for (pros.weeks) |week| {
        for (week.prosHoraires) |semainePro| {
            // Pause 1, Pause2 et Pause3
            for (semainePro.horaires, 0..) |day, dayI| {
                const c = checkPauseDay(semainePro.pro, day);
                if (c) |val| {
                    try out.append(gpa, .{
                        .dayIndex = .{ .week = week.week, .day = @intCast(dayI) },
                        .horaireIndex = sh.horaireToIndex(day.pause.start),
                        .check = .{ .invalidPause = val },
                    });
                }
            }

            // Repos
            const l = checkRepos(semainePro);
            for (l.slice()) |c| {
                try out.append(gpa, .{
                    .dayIndex = .{ .week = week.week, .day = c.dayIndex },
                    .horaireIndex = sh.horaireToIndex(semainePro.horaires[c.dayIndex].presence.end),
                    .check = .{ .notEnoughSleep = c },
                });
            }
        }

        // Reunion 1
        const lReunion = checkReunion(week);
        if (lReunion) |val| {
            try out.append(gpa, .{
                .dayIndex = .{ .week = week.week, .day = val.day },
                .horaireIndex = val.horaireIndex,
                .check = .{ .missingProAtReunion = val },
            });
        }

        // Optionnal roulement check
        if (roulements) |val| {
            const lRoulements = checkRoulements(week, val);
            for (lRoulements.slice()) |c| {
                try out.append(gpa, .{
                    .dayIndex = .{ .week = week.week, .day = c.dayIndex },
                    .horaireIndex = 0,
                    .check = .{ .wrongRoulement = c },
                });
            }
        }
    }

    return try out.toOwnedSlice(gpa);
}

pub const ChildrenCount = struct {
    adaptionCount: u16 = 0,
    marcheurCount: u16 = 0,
    nonMarcheurCount: u16 = 0,

    fn count(self: ChildrenCount) u16 {
        return self.adaptionCount + self.marcheurCount + self.nonMarcheurCount;
    }
};

pub const ProsCountDay = [sh.TimeGridLength]u8;
pub const ChildrenCountDay = [sh.TimeGridLength]ChildrenCount;

pub fn buildChildrenCount(gpa: Allocator, input: sh.ChildrenPlanning) []sh.WeekOf(ChildrenCountDay) {
    var out = gpa.alloc(sh.WeekOf(ChildrenCountDay), input.weekCount) catch unreachable;
    @memset(out, @splat(@splat(ChildrenCount{})));

    for (input.children) |child| {
        for (child.creneaux, 0..) |week, weekI| {
            for (week, 0..) |maybeDay, dayI| {
                const day = maybeDay orelse continue;
                const currentDay = &out[weekI][dayI];
                const bounds = day.horaires.bounds();
                for (bounds[0]..bounds[1]) |index| {
                    if (day.isAdaptation) {
                        currentDay[index].adaptionCount += 1;
                    } else if (child.child.isMarcheur) {
                        currentDay[index].marcheurCount += 1;
                    } else {
                        currentDay[index].nonMarcheurCount += 1;
                    }
                }
            }
        }
    }

    return out;
}

test "buildChildrenCount" {
    const gpa = std.testing.allocator;
    const enfantMarcheur = sh.Child{
        .nom = "Benoit",
        .dateNaissance = "",
        .isMarcheur = true,
    };
    const enfantNonMarcheur = sh.Child{
        .nom = "Benoit",
        .dateNaissance = "",
        .isMarcheur = false,
    };

    var creneaux1 = [_]sh.WeekOf(?sh.ChildDay){
        .{
            null,
            .{ .horaires = r(ho(6, 10), ho(6, 30)), .isAdaptation = true },
            .{ .horaires = r(ho(6, 10), ho(6, 30)), .isAdaptation = false },
            null,
            null,
        },
    };
    var creneaux2 = [_]sh.WeekOf(?sh.ChildDay){
        .{
            null,
            .{ .horaires = r(ho(6, 10), ho(6, 30)), .isAdaptation = false },
            .{ .horaires = r(ho(6, 10), ho(6, 30)), .isAdaptation = false },
            null,
            null,
        },
    };
    var creneaux3 = [_]sh.WeekOf(?sh.ChildDay){
        .{
            null,
            .{ .horaires = r(ho(6, 10), ho(6, 30)), .isAdaptation = false },
            .{ .horaires = r(ho(6, 10), ho(6, 40)), .isAdaptation = false },
            null,
            null,
        },
    };
    var children = [_]sh.ChildCreneaux{
        .{
            .child = enfantMarcheur,
            .creneaux = creneaux1[0..],
        },
        .{
            .child = enfantMarcheur,
            .creneaux = creneaux2[0..],
        },
        .{
            .child = enfantNonMarcheur,
            .creneaux = creneaux3[0..],
        },
    };

    const grid = buildChildrenCount(gpa, .{ .children = children[0..], .weekCount = 1 });
    defer gpa.free(grid);
    try std.testing.expectEqual(ChildrenCount{}, grid[0][0][0]);
    try std.testing.expectEqual(ChildrenCount{}, grid[0][0][100]);
    try std.testing.expectEqual(ChildrenCount{}, grid[0][1][0]);
    try std.testing.expectEqual(ChildrenCount{}, grid[0][1][1]);
    try std.testing.expectEqual(cc(1, 1, 1), grid[0][1][2]);
    try std.testing.expectEqual(cc(0, 2, 1), grid[0][2][2]);
    try std.testing.expectEqual(cc(0, 0, 1), grid[0][2][6]);
}

pub fn buildProsCountDay(
    horaires: []const sh.HoraireTravail,
    detachements: []const (?sh.Detachement),
) ProsCountDay {
    var currentDay: ProsCountDay = [_]u8{0} ** sh.TimeGridLength;
    for (horaires) |proHoraires| {
        const pauseBounds = proHoraires.pause.bounds();
        const presenceBounds = proHoraires.presence.bounds();
        for (presenceBounds[0]..presenceBounds[1]) |index| {
            // gestion de la pause : 2 plages (attention au plages vides)
            if (pauseBounds[0] <= index and index < pauseBounds[1]) continue;
            currentDay[index] += 1;
        }
    }
    // handle detachement
    for (detachements) |detachement| {
        if (detachement) |val| {
            const bounds = val.horaires.bounds();
            for (bounds[0]..bounds[1]) |index| {
                currentDay[index] -= 1;
            }
        }
    }
    return currentDay;
}

fn ho(h: u8, m: u8) sh.Horaire {
    return .{ .heure = h, .minute = m };
}

test "buildProsCountDay" {
    const horaires = [_]sh.HoraireTravail{
        .{
            .presence = .{ .start = ho(8, 30), .end = ho(10, 30) },
            .pause = .{ .start = ho(10, 0), .end = ho(10, 30) },
        },
        .{
            .presence = .{ .start = ho(8, 30), .end = ho(10, 30) },
            .pause = .{ .start = ho(10, 0), .end = ho(10, 30) },
        },
    };
    const detachements = [_](?sh.Detachement){ null, null };

    const c1 = buildProsCountDay(horaires[0..0], detachements[0..0]);
    try std.testing.expect(c1.len == sh.TimeGridLength);
    try std.testing.expect(c1[0] == 0);

    const c2 = buildProsCountDay(horaires[0..2], detachements[0..2]);
    try std.testing.expect(c2.len == sh.TimeGridLength);
    try std.testing.expect(c2[0] == 0 and c2[sh.horaireToIndex(ho(8, 30))] == 2);
}

// do not include interimaires
fn buildProsCount(gpa: Allocator, input: sh.ProsPlanning) []sh.WeekOf(ProsCountDay) {
    var out = gpa.alloc(sh.WeekOf(ProsCountDay), input.weekCount()) catch unreachable;
    @memset(out, @splat(@splat(0)));

    for (input.weeks) |semaine| {
        const weekI = semaine.week;

        var tmp = std.ArrayList(sh.WeekPro).initCapacity(gpa, semaine.prosHoraires.len) catch unreachable;
        // filter "interim" profile
        for (semaine.prosHoraires) |pro| {
            if (pro.pro.isInterimaire) continue;
            tmp.appendAssumeCapacity(pro);
        }
        const withoutInterim = tmp.items;
        var horaires = gpa.alloc(sh.HoraireTravail, withoutInterim.len) catch unreachable;
        var detachements = gpa.alloc(?sh.Detachement, withoutInterim.len) catch unreachable;

        for (0..5) |dayI| {
            // select by day
            for (withoutInterim, 0..) |pro, i| {
                horaires[i] = pro.horaires[dayI];
                detachements[i] = null;
                if (pro.detachement) |det| {
                    if (det.dayIndex == dayI) {
                        detachements[i] = pro.detachement;
                    }
                }
            }
            out[weekI][dayI] = buildProsCountDay(horaires, detachements);
        }

        gpa.free(horaires);
        gpa.free(detachements);
        tmp.deinit(gpa);
    }

    return out;
}

test "buildProsCount" {
    const grid = buildProsCount(std.testing.allocator, .{
        .weeks = &.{
            .{
                .week = 1,
                .roulement = 0,
                .prosHoraires = &.{
                    .{
                        .pro = pr("Audrey"),
                        .horaires = .{
                            .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                        },
                        .detachement = .{
                            .dayIndex = 4,
                            .horaires = r(ho(11, 0), ho(11, 15)),
                        },
                    },
                    .{
                        .pro = pr("Gégé"),
                        .horaires = .{
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                        },
                    },
                    .{
                        .pro = .{ .prenom = "", .color = "", .isInterimaire = true },
                        .horaires = .{
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                            .{ .presence = r(ho(6, 0), ho(18, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
                        },
                    },
                },
            },
        },
    });
    defer std.testing.allocator.free(grid);

    const monday = grid[1][0];
    try std.testing.expectEqual(2, monday[0]);
    try std.testing.expectEqual(0, monday[sh.horaireToIndex(ho(10, 30))]);
    try std.testing.expectEqual(1, monday[sh.horaireToIndex(ho(13, 30))]);
    try std.testing.expectEqual(0, monday[sh.horaireToIndex(ho(18, 0))]);
    const friday = grid[1][4]; // détachement
    try std.testing.expectEqual(1, friday[sh.horaireToIndex(ho(11, 0))]);
    try std.testing.expectEqual(2, friday[sh.horaireToIndex(ho(11, 15))]);
}

const ChildrenCountCheck = struct {
    gotProsCount: u16,
    expectedProsCount: u16,
    adaptationCount: u16,
};

fn checkChildrenCount(children: ChildrenCount, pros_: u16) ?ChildrenCountCheck {
    const marcheursParPro = 8;
    const nonMarcheursParPro = 5;

    // adaption requires a full pro
    if (children.adaptionCount > pros_) {
        return ChildrenCountCheck{
            .gotProsCount = pros_,
            .expectedProsCount = children.adaptionCount,
            .adaptationCount = children.adaptionCount,
        };
    }

    const pros = pros_ - children.adaptionCount;

    // special case for 1 pro
    if (pros <= 1) {
        if (children.marcheurCount + children.nonMarcheurCount > 3) {
            return ChildrenCountCheck{
                .gotProsCount = pros,
                .expectedProsCount = 2,
                .adaptationCount = children.adaptionCount,
            };
        }
    }

    // attribute the non Marcheurs, and fill with marcheurs
    const prosForNonMarcheurs = std.math.divCeil(u16, children.nonMarcheurCount, nonMarcheursParPro) catch 0;
    const nonCompleteNonMarcheurs = children.nonMarcheurCount % nonMarcheursParPro;

    var marcheursToAttribute = children.marcheurCount;
    if (nonCompleteNonMarcheurs != 0) {
        // "groupe mixte" : fill with marcheurs
        const placesToFill = nonMarcheursParPro - nonCompleteNonMarcheurs;
        marcheursToAttribute -= @min(placesToFill, marcheursToAttribute);
    }
    const otherPros: u16 = if (marcheursToAttribute > 0) std.math.divCeil(u16, marcheursToAttribute, marcheursParPro) catch 0 else 0;
    const expected = prosForNonMarcheurs + otherPros;
    if (expected > pros) {
        return ChildrenCountCheck{
            .gotProsCount = pros,
            .expectedProsCount = expected,
            .adaptationCount = children.adaptionCount,
        };
    }

    // all good !
    return null;
}

fn cc(adaptionCount: u16, marcheurCount: u16, nonMarcheurCount: u16) ChildrenCount {
    return ChildrenCount{ .adaptionCount = adaptionCount, .marcheurCount = marcheurCount, .nonMarcheurCount = nonMarcheurCount };
}

test "check children count" {
    try std.testing.expect(checkChildrenCount(cc(0, 0, 0), 0) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 0, 0), 1) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 0, 0), 3) == null);

    try std.testing.expect(checkChildrenCount(cc(0, 2, 1), 1) == null);
    try std.testing.expect(checkChildrenCount(cc(0, 4, 0), 1) != null);
    try std.testing.expect(checkChildrenCount(cc(0, 2, 2), 1) != null);

    try std.testing.expect(checkChildrenCount(cc(2, 0, 0), 1) != null);
    try std.testing.expect(checkChildrenCount(cc(1, 3, 0), 3) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 16, 0), 3) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 17, 0), 3) != null);
    try std.testing.expect(checkChildrenCount(cc(1, 0, 6), 3) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 0, 7), 3) == null);
    try std.testing.expect(checkChildrenCount(cc(1, 0, 11), 3) != null);
    try std.testing.expect(checkChildrenCount(cc(1, 2, 4), 3) == null);
    try std.testing.expect(checkChildrenCount(cc(0, 5, 6), 2) != null);

    try std.testing.expect(checkChildrenCount(cc(0, 5, 5), 2) == null);

    try std.testing.expect(checkChildrenCount(cc(0, 0, 9), 2) == null);
}

const ChildrenCheck = struct {
    horaire: sh.TimeIndex,
    check: ChildrenCountCheck,
};

// checks rules Enfants 1, Enfants 2 et Reunion 2, Adaptation 1
// for the given day, and returns the first error
pub fn checkChildrenCountDay(dayChildren: ChildrenCountDay, dayPros: ProsCountDay, reunionRange: ?sh.Range) ?ChildrenCheck {
    for (dayChildren, 0..) |count, i| {
        const timeI: sh.TimeIndex = @intCast(i);
        if (reunionRange) |reunion| {
            if (reunion.contains(sh.indexToHoraire(timeI))) {
                // Reunion 2 : no need to check anything
                continue;
            }
        }
        const pros = dayPros[timeI];
        const err = checkChildrenCount(count, pros);
        if (err) |value| {
            // only include one check by day
            return .{
                .horaire = timeI,
                .check = value,
            };
        }
    }
    return null;
}

// 8h30
pub const LargeDay: sh.TimeIndex = 8 * 12 + 6;
// 8h15
pub const MediumDay: sh.TimeIndex = 8 * 12 + 3;

const MissingPause = struct { pro: sh.Pro };
const WrongPauseDuration = struct { pro: sh.Pro, got: u32, reason: sh.string };
const WrongPauseHoraire = struct { pro: sh.Pro, got: sh.Range };

const PauseCheck = union(enum) {
    missing: MissingPause,
    wrongDuration: WrongPauseDuration,
    wrongHoraire: WrongPauseHoraire,
};

pub fn checkPauseDay(pro: sh.Pro, horaires: sh.HoraireTravail) ?PauseCheck {
    const thresholdInMinutes = 6 * 60;
    const arrivalInMeal = sh.Range{
        .start = sh.Horaire{ .heure = 11, .minute = 0 },
        .end = sh.Horaire{ .heure = 12, .minute = 0 },
    };

    // never check pauses if the pro is away
    if (horaires.presence.isEmpty()) {
        return null;
    }

    const pauseDuration = horaires.pause.duration();

    // special case (Interim)
    if (pro.isInterimaire) {
        if (pauseDuration != 60) {
            return PauseCheck{ .wrongDuration = .{
                .pro = pro,
                .got = pauseDuration,
                .reason = "60 min. en intérim",
            } };
        }
        return null; // nothing else to check
    }

    const repas = sh.Range{ .start = .{ .heure = 11, .minute = 30 }, .end = .{ .heure = 12, .minute = 30 } };
    if (horaires.pause.isEmpty()) {
        // check it was not mandatory
        const workDuration = horaires.presence.duration();
        const isPauseMandatory =
            workDuration >= thresholdInMinutes or
            arrivalInMeal.contains(horaires.presence.start);

        if (isPauseMandatory) {
            return PauseCheck{ .missing = MissingPause{
                .pro = pro,
            } };
        }
        return null;
    }

    // check the pause is valid
    if (repas.overlaps(horaires.pause)) {
        return PauseCheck{ .wrongHoraire = WrongPauseHoraire{
            .pro = pro,
            .got = horaires.pause,
        } };
    }

    if (pauseDuration < 30 or pauseDuration > 60) {
        return PauseCheck{ .wrongDuration = WrongPauseDuration{
            .pro = pro,
            .got = pauseDuration,
            .reason = "Pause entre 30 et 60 min.",
        } };
    }
    // Pause 3
    const amplitude = horaires.presence.duration();
    if (amplitude >= 5 * LargeDay and pauseDuration < 60) {
        return PauseCheck{ .wrongDuration = WrongPauseDuration{
            .pro = pro,
            .got = pauseDuration,
            .reason = "Pour une journée de 8h30, 60min.",
        } };
    } else if (amplitude == 5 * MediumDay and pauseDuration < 45) {
        return PauseCheck{ .wrongDuration = WrongPauseDuration{
            .pro = pro,
            .got = pauseDuration,
            .reason = "Pour une journée de 8h15, au moins 45min.",
        } };
    }

    return null;
}

fn r(start: sh.Horaire, end: sh.Horaire) sh.Range {
    return .{ .start = start, .end = end };
}

test "check pause day" {
    const pro = sh.Pro{
        .prenom = "Audrey",
        .color = "#FFFFFF",
        .isInterimaire = false,
    };
    try std.testing.expect(checkPauseDay(pro, .{ .presence = r(ho(6, 0), ho(7, 0)), .pause = sh.Range.empty() }) == null);
    try std.testing.expect(checkPauseDay(pro, .{ .presence = r(ho(6, 0), ho(11, 45)), .pause = sh.Range.empty() }) == null);
    try std.testing.expect(checkPauseDay(pro, .{ .presence = r(ho(6, 0), ho(12, 0)), .pause = sh.Range.empty() }) != null);
    try std.testing.expect(checkPauseDay(pro, .{ .presence = r(ho(11, 0), ho(14, 0)), .pause = sh.Range.empty() }) != null);
    try std.testing.expect(checkPauseDay(pro, .{ .presence = r(ho(13, 0), ho(14, 0)), .pause = sh.Range.empty() }) == null);

    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(11, 0), ho(14, 0)),
        .pause = r(ho(13, 30), ho(14, 0)),
    }) == null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(11, 0), ho(14, 0)),
        .pause = r(ho(12, 50), ho(14, 0)),
    }) != null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(11, 0), ho(14, 0)),
        .pause = r(ho(13, 0), ho(13, 10)),
    }) != null);
    // large pause
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(8, 0), ho(18, 0)),
        .pause = r(ho(13, 0), ho(14, 0)),
    }) == null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(8, 0), ho(18, 0)),
        .pause = r(ho(13, 0), ho(13, 45)),
    }) != null);

    //   interim
    const interim: sh.Pro = .{ .prenom = "", .color = "", .isInterimaire = true };
    try std.testing.expect(checkPauseDay(interim, .{
        .presence = r(ho(10, 0), ho(15, 0)),
        .pause = r(ho(12, 0), ho(13, 0)),
    }) == null);
    try std.testing.expect(checkPauseDay(interim, .{
        .presence = r(ho(10, 0), ho(15, 0)),
        .pause = r(ho(13, 0), ho(14, 0)),
    }) == null);
    try std.testing.expect(checkPauseDay(interim, .{
        .presence = r(ho(8, 0), ho(18, 0)),
        .pause = r(ho(13, 0), ho(13, 45)),
    }) != null);
}

const WrongAdaptationHoraire = struct {
    got: sh.Range,
};

fn checkAdaptationHoraires(childHoraires: sh.Range) ?WrongAdaptationHoraire {
    const accepted = sh.Range{ .start = sh.Horaire{ .heure = 9, .minute = 0 }, .end = sh.Horaire{ .heure = 17, .minute = 0 } };
    if (accepted.includes(childHoraires)) {
        // all good
        return null;
    }
    return .{ .got = childHoraires };
}

test "check adaptations horaires" {
    try std.testing.expect(checkAdaptationHoraires(r(ho(6, 0), ho(7, 0))) != null);
    try std.testing.expect(checkAdaptationHoraires(r(ho(10, 0), ho(10, 30))) == null);
    try std.testing.expect(checkAdaptationHoraires(r(ho(15, 45), ho(17, 45))) != null);
}

pub const Arrivals = struct {
    firstArrival: sh.TimeIndex,
    secondArrival: sh.TimeIndex,
    beforeLastGo: sh.TimeIndex,
    lastGo: sh.TimeIndex,
};

fn firstIndex(comptime T: type, slice: []const T, criteria: fn (T) bool) ?usize {
    for (slice, 0..) |value, i| {
        if (criteria(value)) {
            return i;
        }
    }
    return null;
}

fn lastIndex(comptime T: type, slice: []const T, criteria: fn (T) bool) ?usize {
    var i: usize = slice.len;
    while (i > 0) {
        i -= 1;
        const value = slice[i];
        if (criteria(value)) {
            return i;
        }
    }
    return null;
}

fn has1Child(c: ChildrenCount) bool {
    return c.count() > 0;
}
fn has4Children(c: ChildrenCount) bool {
    return c.count() >= 4;
}

pub fn expectedArrivals(children: []const ChildrenCount) Arrivals {
    // first arrival
    const indexFirstChild = firstIndex(ChildrenCount, children, has1Child) orelse return .{
        .firstArrival = sh.TimeIndexEmpty,
        .secondArrival = sh.TimeIndexEmpty,
        .beforeLastGo = sh.TimeIndexEmpty,
        .lastGo = sh.TimeIndexEmpty,
    };

    const firstArrival: sh.TimeIndex = @intCast(indexFirstChild - sh.minutesToIndex(15));

    // last go
    const indexLastChild = lastIndex(ChildrenCount, children, has1Child) orelse unreachable;
    const lastGo: sh.TimeIndex = @intCast(indexLastChild + sh.minutesToIndex(30));

    // second arrival
    const indexFourthChild = firstIndex(ChildrenCount, children, has4Children) orelse return .{
        // never more than 3; nothing to check
        .firstArrival = firstArrival,
        .secondArrival = sh.TimeIndexEmpty,
        .beforeLastGo = sh.TimeIndexEmpty,
        .lastGo = lastGo,
    };

    const secondArrival: sh.TimeIndex = @intCast(indexFourthChild - sh.minutesToIndex(15));

    // before last go
    const indexLastFourthChild = lastIndex(ChildrenCount, children, has4Children) orelse unreachable;
    const beforeLastGo: sh.TimeIndex = @intCast(indexLastFourthChild + sh.minutesToIndex(15));

    return .{
        .firstArrival = firstArrival,
        .secondArrival = secondArrival,
        .beforeLastGo = beforeLastGo,
        .lastGo = lastGo,
    };
}

const WrongDepartArriveePro = struct {
    moment: enum {
        firstArrival,
        secondArrival,
        beforeLastGo,
        lastGo,
    },
    expected: sh.Horaire,
    got: sh.Horaire,
};

const ArrivalsCheck = sh.FixedBuffer(WrongDepartArriveePro, 4);

fn hasOne(v: u8) bool {
    return v > 0;
}
fn hasTwo(v: u8) bool {
    return v >= 2;
}

fn prosArrivals(pros: []const sh.Range) Arrivals {
    // find the two smallest start and two largest end values,
    // excluding empty ranges

    var firstArrival = sh.TimeIndexEmpty;
    var secondArrival = sh.TimeIndexEmpty;
    var beforeLastGo: sh.TimeIndex = 0;
    var lastGo: sh.TimeIndex = 0;
    for (pros) |value| {
        if (value.isEmpty()) continue;

        const start = sh.horaireToIndex(value.start);
        if (start < firstArrival) { // shift 1 2 -> new 1
            secondArrival = firstArrival;
            firstArrival = start;
        } else if (start < secondArrival) {
            secondArrival = start;
        }

        const end = sh.horaireToIndex(value.end) - 1; // we return last presence
        if (end > lastGo) {
            beforeLastGo = lastGo;
            lastGo = end;
        } else if (end > beforeLastGo) {
            beforeLastGo = end;
        }
    }

    return .{
        .firstArrival = firstArrival,
        .secondArrival = secondArrival,
        .beforeLastGo = beforeLastGo,
        .lastGo = lastGo,
    };
}

// Arrivee: La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.
// Depart: L’avant-dernière pro doit partir 15 min après le 4° enfant restant, la dernière pro 30 min après le dernier enfant.
fn checkProsArrivals(children: []const ChildrenCount, prosHoraires: []const sh.Range) ArrivalsCheck {
    var out = ArrivalsCheck{};

    const expected = expectedArrivals(children);
    const got = prosArrivals(prosHoraires);

    // if there is no kids, all good !
    if (expected.firstArrival == sh.TimeIndexEmpty) return out;

    // first arrival
    if (expected.firstArrival != got.firstArrival) {
        out.push(.{
            .moment = .firstArrival,
            .expected = sh.indexToHoraire(expected.firstArrival),
            .got = sh.indexToHoraire(got.firstArrival),
        });
    }

    // last go
    if (expected.lastGo != got.lastGo) {
        // the index here are the last PRESENCE, so the
        // depart is actually the next (hence the +1 in the returned value)

        out.push(.{
            .moment = .lastGo,
            .expected = sh.indexToHoraire(expected.lastGo + 1),
            .got = sh.indexToHoraire(got.lastGo + 1),
        });
    }

    // second arrival
    if (expected.secondArrival == sh.TimeIndexEmpty) {
        // never more than 3; nothing to check
        return out;
    }

    if (expected.secondArrival != got.secondArrival) {
        out.push(.{
            .moment = .secondArrival,
            .expected = sh.indexToHoraire(expected.secondArrival),
            .got = sh.indexToHoraire(got.secondArrival),
        });
    }

    // before last go
    if (expected.beforeLastGo != got.beforeLastGo) {
        out.push(.{
            .moment = .beforeLastGo,
            .expected = sh.indexToHoraire(expected.beforeLastGo + 1),
            .got = sh.indexToHoraire(got.beforeLastGo + 1),
        });
    }

    return out;
}

fn ri(start: sh.TimeIndex, end: sh.TimeIndex) sh.Range {
    return .{ .start = sh.indexToHoraire(start), .end = sh.indexToHoraire(end) };
}

test "check pros arrivals" {
    const enfants2 = &[_]ChildrenCount{
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 1, 0),
        cc(0, 1, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
        cc(0, 0, 0),
    };

    try std.testing.expect(checkProsArrivals(enfants2, &[_]sh.Range{ri(1, 12)}).len == 0);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]sh.Range{ ri(1, 12), ri(1, 2) }).len == 0);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]sh.Range{ ri(0, 12), ri(1, 2) }).len == 1);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]sh.Range{ri(2, 12)}).len == 1);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]sh.Range{ri(2, 10)}).len == 2);

    // with more than 3
    const enfants5 = &[_]ChildrenCount{
        cc(0, 0, 0), // 0
        cc(0, 0, 0), // 1
        cc(0, 0, 0), // 2
        cc(0, 0, 0), // 3
        cc(0, 1, 0), // 4
        cc(0, 2, 1), // 5
        cc(0, 2, 1), // 6
        cc(0, 2, 3), // 7
        cc(0, 0, 0), // 8
        cc(0, 0, 0), // 9
        cc(0, 0, 0), // 10
        cc(0, 0, 0), // 11
        cc(0, 0, 0), // 12
        cc(0, 0, 0), // 13
        cc(0, 0, 0), // 14
        cc(0, 0, 0), // 15
    };

    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(1, 14), ri(4, 11) }).len == 0);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(1, 14), ri(5, 11) }).len == 1);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(2, 14), ri(5, 11) }).len == 2);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(2, 13), ri(5, 11) }).len == 3);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(2, 15), ri(5, 11) }).len == 3);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]sh.Range{ ri(2, 15), ri(5, 10) }).len == 4);

    const diags = checkProsArrivals(enfants5, &[_]sh.Range{ ri(2, 15), ri(5, 12) });
    try std.testing.expect(diags.len == 4);
    // check the depart horaire is correct
    const first, const last, const second, const secondLast = diags.buffer;
    try std.testing.expect(first.moment == .firstArrival);
    try std.testing.expect(last.moment == .lastGo);
    try std.testing.expect(second.moment == .secondArrival);
    try std.testing.expect(secondLast.moment == .beforeLastGo);

    try std.testing.expectEqual(sh.indexToHoraire(1), first.expected);
    try std.testing.expectEqual(sh.indexToHoraire(2), first.got);

    try std.testing.expectEqual(sh.indexToHoraire(4), second.expected);
    try std.testing.expectEqual(sh.indexToHoraire(5), second.got);

    try std.testing.expectEqual(sh.indexToHoraire(14), last.expected);
    try std.testing.expectEqual(sh.indexToHoraire(15), last.got);

    try std.testing.expectEqual(sh.indexToHoraire(11), secondLast.expected);
    try std.testing.expectEqual(sh.indexToHoraire(12), secondLast.got);
}

const MissingProAtReunion = struct {
    day: u8,
    horaireIndex: sh.TimeIndex,
    missingCount: usize,
    missing: sh.Pro,
};

fn checkReunion(semaine: sh.WeekPros) ?MissingProAtReunion {
    const reunion = semaine.reunion orelse return null;

    const reunionRange = reunion.range();
    var missingCount: usize = 0;
    var missingIndex: ?usize = null;
    // check each pro is present and not in pause
    for (semaine.prosHoraires, 0..) |pro, i| {
        const proAtDayReunion = pro.horaires[reunion.day];
        // vacations : OK
        if (proAtDayReunion.presence.isEmpty()) {
            continue;
        }
        if (proAtDayReunion.presence.includes(reunionRange) and
            !proAtDayReunion.pause.overlaps(reunionRange))
        {
            continue; // OK
        }
        missingCount += 1;
        missingIndex = i;
    }

    if (missingIndex) |i| {
        return .{
            .day = reunion.day,
            .horaireIndex = sh.horaireToIndex(reunion.horaire),
            .missingCount = missingCount,
            .missing = semaine.prosHoraires[i].pro,
        };
    }

    return null;
}

fn pr(prenom: sh.string) sh.Pro {
    return .{ .prenom = prenom, .color = "#FFFFFF", .isInterimaire = false };
}

test "check reunion" {
    const pro = pr("Audrey");

    const week0 = sh.WeekPros{
        .week = 0,
        .roulement = 0,
        .prosHoraires = &[_]sh.WeekPro{
            .{
                .pro = pro,
                .horaires = .{
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{
                        .presence = r(ho(6, 0), ho(16, 0)),
                        .pause = r(ho(10, 30), ho(11, 0)),
                    },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                },
            },
            .{
                .pro = pro,
                .horaires = .{
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{
                        .presence = r(ho(6, 0), ho(16, 0)),
                        .pause = r(ho(10, 30), ho(11, 0)),
                    },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                    .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
                },
            },
        },
    };

    const week1 = sh.WeekPros{ .week = 1, .roulement = 0, .reunion = .{ .day = 1, .horaire = ho(13, 30) }, .prosHoraires = &[_]sh.WeekPro{
        .{ .pro = pr("pro1"), .horaires = .{
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{
                .presence = r(ho(6, 0), ho(16, 0)),
                .pause = r(ho(10, 30), ho(11, 0)),
            },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
        } },
        .{ .pro = pr("pro2"), .horaires = .{
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{
                .presence = r(ho(6, 0), ho(16, 0)),
                .pause = r(ho(10, 30), ho(14, 0)),
            },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
        } },
        .{ .pro = pr("pro3"), .horaires = .{
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
        } },
    } };

    const week2 = sh.WeekPros{ .week = 2, .roulement = 0, .prosHoraires = &[_]sh.WeekPro{
        .{ .pro = pro, .horaires = .{
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{
                .presence = r(ho(6, 0), ho(16, 0)),
                .pause = r(ho(10, 30), ho(11, 0)),
            },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
        } },
        .{ .pro = pro, .horaires = .{
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{
                .presence = r(ho(6, 0), ho(16, 0)),
                .pause = r(ho(10, 30), ho(14, 0)),
            },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
        } },
    } };

    try std.testing.expect(checkReunion(week0) == null);

    const diag_ = checkReunion(week1);
    try std.testing.expect(diag_ != null);
    const diag = diag_ orelse unreachable;
    try std.testing.expect(diag.day == 1);
    try std.testing.expect(diag.missingCount == 1);
    try std.testing.expectEqualStrings("pro2", diag.missing.prenom);
    try std.testing.expect(diag.horaireIndex == sh.horaireToIndex(ho(13, 30)));

    try std.testing.expect(checkReunion(week2) == null);
}

const NotEnoughSleep = struct {
    pro: sh.Pro,
    dayIndex: u8,
    expectedLendemain: sh.Horaire,
    gotLendemain: sh.Horaire,
};

const ReposCheck = sh.FixedBuffer(NotEnoughSleep, 4);

fn checkRepos(pro: sh.WeekPro) ReposCheck {
    var out = ReposCheck{};

    for (0..4) |iDay| {
        const c = checkReposNight(
            pro.pro,
            @intCast(iDay),
            pro.horaires[iDay].presence,
            pro.horaires[iDay + 1].presence,
        );
        if (c) |val| {
            out.push(val);
        }
    }
    return out;
}

fn checkReposNight(pro: sh.Pro, dayIndex: u8, day: sh.Range, following: sh.Range) ?NotEnoughSleep {
    if (day.isEmpty() or following.isEmpty()) {
        // empty day, all good !
        return null;
    }
    const expectedRepos = 11; // heures
    if (day.end.heure + expectedRepos < 24) { // full of time !
        return null;
    }
    const lendemain = sh.Horaire{
        .heure = (day.end.heure + expectedRepos - 24),
        .minute = day.end.minute,
    };
    if (sh.Horaire.isBefore(lendemain, following.start)) {
        // all good!
        return null;
    }
    return .{ .pro = pro, .dayIndex = dayIndex, .expectedLendemain = lendemain, .gotLendemain = following.start };
}

test "check repos" {
    const weekPro = sh.WeekPro{
        .pro = pr("Audrey"),
        .horaires = .{
            .{ .presence = r(ho(6, 0), ho(20, 15)), .pause = sh.Range.empty() },
            .{ .presence = r(ho(7, 0), ho(16, 0)), .pause = r(ho(10, 30), ho(11, 0)) },
            .{ .presence = sh.Range.empty(), .pause = sh.Range.empty() },
            .{ .presence = r(ho(6, 0), ho(20, 0)), .pause = sh.Range.empty() },
            .{
                .presence = r(ho(7, 0), ho(16, 0)), // just enough !
                .pause = sh.Range.empty(),
            },
        },
    };
    const diags = checkRepos(weekPro);
    try std.testing.expect(diags.len == 1);
    try std.testing.expectEqual(ho(7, 15), diags.slice()[0].expectedLendemain);
}

const WrongRoulement = struct {
    dayIndex: u8,
    expectedOrder: [4]sh.string,
    gotOrder: [4]sh.string,
};

const RoulementCheck = sh.FixedBuffer(WrongRoulement, 5);

fn checkRoulements(week: sh.WeekPros, roulements: sh.Roulements) RoulementCheck {
    if (week.prosHoraires.len < 4) return RoulementCheck{}; // dont bother to guess

    const pros = week.prosHoraires[0..4];
    const expectedRoulement = roulements.weeks[week.roulement];

    const proIndex = struct {
        presence: sh.Range,
        index: usize,

        const Self = @This();

        // returns true if h1 < h2
        pub fn isLess(_: void, h1: Self, h2: Self) bool {
            const start = sh.Horaire.compare(h1.presence.start, h2.presence.start);
            if (start != 0) return start == -1;
            // if the arrivals are the same, compare departures
            return sh.Horaire.compare(h1.presence.end, h2.presence.end) == -1;
        }
    };

    var out = RoulementCheck{};
    for (0..5) |dayI| {
        // expected
        const exp = sh.creneauxOrder(expectedRoulement[dayI]);
        // real
        var prosForDay: [4]proIndex = @splat(undefined);
        var allAway = true;
        inline for (pros, 0..) |pro, i| {
            const presence = pro.horaires[dayI].presence;
            prosForDay[i] = .{ .presence = presence, .index = i };
            if (!presence.isEmpty()) {
                allAway = false;
            }
        }
        if (allAway) {
            // do not check a day with no one
            continue;
        }

        // sort by arrival
        std.mem.sortUnstable(proIndex, &prosForDay, {}, proIndex.isLess);

        const got = .{ prosForDay[0].index, prosForDay[1].index, prosForDay[2].index, prosForDay[3].index };
        if (!std.mem.eql(usize, &exp, &got)) {
            out.push(.{
                .dayIndex = @intCast(dayI),
                .expectedOrder = .{ pros[exp[0]].pro.prenom, pros[exp[1]].pro.prenom, pros[exp[2]].pro.prenom, pros[exp[3]].pro.prenom },
                .gotOrder = .{ pros[got[0]].pro.prenom, pros[got[1]].pro.prenom, pros[got[2]].pro.prenom, pros[got[3]].pro.prenom },
            });
        }
    }

    return out;
}

fn hFromA(h: u8, m: u8) sh.HoraireTravail {
    return .{
        .presence = r(ho(h, m), ho(12, 0)),
        .pause = sh.Range.empty(),
    };
}

test "check roulements" {
    const roulements0: sh.Roulements = .{ .weeks = &.{
        .{
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
        },
    } };
    const week0 = sh.WeekPros{
        .week = 0,
        .roulement = 0,
        .prosHoraires = &.{
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                },
            },
        },
    };
    const diagsOK = checkRoulements(week0, roulements0);
    try std.testing.expect(diagsOK.len == 0);

    const roulements1: sh.Roulements = .{ .weeks = &.{
        .{
            .{ .m, .o, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .s, .m, .o, .f },
            .{ .o, .m, .s, .f },
        },
    } };
    const week1 = sh.WeekPros{
        .week = 0,
        .roulement = 0,
        .prosHoraires = &.{
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                    hFromA(6, 0),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                    hFromA(8, 0),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                    hFromA(8, 30),
                },
            },
            .{
                .pro = pr("pro"),
                .horaires = .{
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                    hFromA(12, 30),
                },
            },
        },
    };

    const diagsErr = checkRoulements(week1, roulements1);
    try std.testing.expect(diagsErr.len == 2);
}

// be careful with arrivals and pauses : the "pro count" approach is then broken
test "proArrivals" {
    const gpa = std.testing.allocator;

    const D = struct {
        fn child(depart: sh.Horaire) sh.WeekOf(?sh.ChildDay) {
            return .{ .{ .horaires = r(ho(13, 0), depart) }, null, null, null, null };
        }

        fn pro(presence: sh.Range, pause: sh.Range) sh.WeekPro {
            return .{
                .pro = .{},
                .horaires = [_]sh.HoraireTravail{ .{
                    .presence = presence,
                    .pause = pause,
                }, .{
                    .presence = sh.Range.empty(),
                    .pause = sh.Range.empty(),
                }, .{
                    .presence = sh.Range.empty(),
                    .pause = sh.Range.empty(),
                }, .{
                    .presence = sh.Range.empty(),
                    .pause = sh.Range.empty(),
                }, .{
                    .presence = sh.Range.empty(),
                    .pause = sh.Range.empty(),
                } },
            };
        }
    };

    var childrenL = [_]sh.ChildCreneaux{
        .{ .child = .{}, .creneaux = @constCast(&[_]sh.WeekOf(?sh.ChildDay){D.child(ho(15, 15))}) },
        .{ .child = .{}, .creneaux = @constCast(&[_]sh.WeekOf(?sh.ChildDay){D.child(ho(19, 0))}) },
        .{ .child = .{}, .creneaux = @constCast(&[_]sh.WeekOf(?sh.ChildDay){D.child(ho(19, 0))}) },
        .{ .child = .{}, .creneaux = @constCast(&[_]sh.WeekOf(?sh.ChildDay){D.child(ho(19, 0))}) },
    };
    const children = sh.ChildrenPlanning{
        .children = &childrenL,
        .weekCount = 1,
    };
    const pros = sh.ProsPlanning{ .weeks = &[_]sh.WeekPros{.{
        .week = 0,
        .prosHoraires = &[_]sh.WeekPro{
            D.pro(r(ho(12, 45), ho(15, 30)), r(ho(14, 0), ho(14, 30))),
            D.pro(r(ho(12, 45), ho(19, 30)), r(ho(15, 0), ho(15, 30))),
        },
        .roulement = 0,
    }} };

    const diags = try checkPlanning(gpa, children, pros, null);
    defer gpa.free(diags);
    try std.testing.expectEqual(1, diags.len);
}

test "check sample 0" {
    const gpa = std.testing.allocator;

    const fileC = try std.fs.cwd().readFileAlloc(gpa, "testdata/children_0.json", std.math.maxInt(usize));
    defer gpa.free(fileC);
    const parsedC = try std.json.parseFromSlice(sh.ChildrenPlanning, gpa, fileC, .{ .ignore_unknown_fields = true });
    defer parsedC.deinit();

    const fileP = try std.fs.cwd().readFileAlloc(gpa, "testdata/pros_0.json", std.math.maxInt(usize));
    defer gpa.free(fileP);
    const parsedP = try std.json.parseFromSlice(sh.ProsPlanning, gpa, fileP, .{ .ignore_unknown_fields = true });
    defer parsedP.deinit();

    const children: sh.ChildrenPlanning = parsedC.value;
    const pros: sh.ProsPlanning = parsedP.value;

    try std.testing.expectEqual(12, children.children.len);
    try std.testing.expectEqual(4, pros.weeks.len);

    const diags = try checkPlanning(gpa, children, pros, null);
    defer gpa.free(diags);

    try std.testing.expectEqual(36, diags.len);
}

test "check sample 1" {
    const gpa = std.testing.allocator;

    const fileC = try std.fs.cwd().readFileAlloc(gpa, "testdata/children_1.json", std.math.maxInt(usize));
    defer gpa.free(fileC);
    const parsedC = try std.json.parseFromSlice(sh.ChildrenPlanning, gpa, fileC, .{ .ignore_unknown_fields = true });
    defer parsedC.deinit();

    const fileP = try std.fs.cwd().readFileAlloc(gpa, "testdata/pros_1.json", std.math.maxInt(usize));
    defer gpa.free(fileP);
    const parsedP = try std.json.parseFromSlice(sh.ProsPlanning, gpa, fileP, .{ .ignore_unknown_fields = true });
    defer parsedP.deinit();

    const children: sh.ChildrenPlanning = parsedC.value;
    const pros: sh.ProsPlanning = parsedP.value;

    try std.testing.expectEqual(13, children.children.len);
    try std.testing.expectEqual(5, pros.weeks.len);

    const diags = try checkPlanning(gpa, children, pros, null);
    defer gpa.free(diags);

    try std.testing.expectEqual(32, diags.len);
}
