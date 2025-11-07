const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");

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
    for (out, 0..) |_, i| { // init with 0
        out[i] = @splat(@splat(ChildrenCount{}));
    }

    for (input.children) |child| {
        for (child.creneaux, 0..) |week, weekI| {
            for (week, 0..) |maybeDay, dayI| {
                const day = maybeDay orelse continue;
                const currentDay = &out[weekI][dayI];
                const bounds = sh.rangeToBounds(day.horaires);
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
        const pauseBounds = sh.rangeToBounds(proHoraires.pause);
        const presenceBounds = sh.rangeToBounds(proHoraires.presence);
        for (presenceBounds[0]..presenceBounds[1]) |index| {
            // gestion de la pause : 2 plages (attention au plages vides)
            if (pauseBounds[0] <= index and index <= pauseBounds[1]) continue;
            currentDay[index] += 1;
        }
    }
    // handle detachement
    for (detachements) |detachement| {
        if (detachement) |val| {
            const bounds = sh.rangeToBounds(val.horaires);
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
        const check = checkChildrenCount(count, pros);
        if (check) |value| {
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
const WrongPauseDuration = struct { pro: sh.Pro, got: u16, reason: sh.string };
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

const ArrivalsCheck = FixedBuffer(WrongDepartArriveePro, 4);

fn hasOne(v: u8) bool {
    return v > 0;
}
fn hasTwo(v: u8) bool {
    return v >= 2;
}

// Arrivee: La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.
// Depart: L’avant-dernière pro doit partir 15 min après le 4° enfant restant, la dernière pro 30 min après le dernier enfant.
fn checkProsArrivals(children: []const ChildrenCount, pros: []const u8) ArrivalsCheck {
    var out = ArrivalsCheck{};

    const expected = expectedArrivals(children);

    // if there is no kids, all good !
    if (expected.firstArrival == sh.TimeIndexEmpty) return out;

    // first arrival
    const indexFirstPro = firstIndex(u8, pros, hasOne) orelse 0;
    if (expected.firstArrival != indexFirstPro) {
        out.push(.{
            .moment = .firstArrival,
            .expected = sh.indexToHoraire(expected.firstArrival),
            .got = sh.indexToHoraire(@intCast(indexFirstPro)),
        });
    }

    // last go
    const indexLastPro = lastIndex(u8, pros, hasOne) orelse 0;
    if (expected.lastGo != indexLastPro) {
        // the index here are the last PRESENCE, so the
        // depart is actually the next (hence the +1 in the returned value)

        out.push(.{
            .moment = .lastGo,
            .expected = sh.indexToHoraire(expected.lastGo + 1),
            .got = sh.indexToHoraire(@intCast(indexLastPro + 1)),
        });
    }

    // second arrival
    if (expected.secondArrival == sh.TimeIndexEmpty) {
        // never more than 3; nothing to check
        return out;
    }

    const indexSecondPro = firstIndex(u8, pros, hasTwo) orelse 0;
    if (expected.secondArrival != indexSecondPro) {
        out.push(.{
            .moment = .secondArrival,
            .expected = sh.indexToHoraire(expected.secondArrival),
            .got = sh.indexToHoraire(@intCast(indexSecondPro)),
        });
    }

    // before last go
    const indexBeforeLastPro = lastIndex(u8, pros, hasTwo) orelse 0;
    if (expected.beforeLastGo != indexBeforeLastPro) {
        out.push(.{
            .moment = .beforeLastGo,
            .expected = sh.indexToHoraire(expected.beforeLastGo + 1),
            .got = sh.indexToHoraire(@intCast(indexBeforeLastPro + 1)),
        });
    }

    return out;
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
    try std.testing.expect(checkProsArrivals(enfants2, &[_]u8{ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 }).len == 0);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]u8{ 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 }).len == 0);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]u8{ 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 }).len == 1);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]u8{ 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 }).len == 1);
    try std.testing.expect(checkProsArrivals(enfants2, &[_]u8{ 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0 }).len == 2);

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
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0 }).len == 0);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0 }).len == 1);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0 }).len == 2);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0 }).len == 3);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0 }).len == 3);
    try std.testing.expect(checkProsArrivals(enfants5, &[_]u8{ 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0 }).len == 4);
    const diags = checkProsArrivals(enfants5, &[_]u8{ 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0 });
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
    missing: sh.Pro,
};

fn checkReunion(semaine: sh.WeekPros) ?MissingProAtReunion {
    const reunion = semaine.reunion orelse return null;

    const reunionRange = reunion.range();
    // check each pro is present and not in pause
    for (semaine.prosHoraires) |pro| {
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
        return .{
            .day = reunion.day,
            .horaireIndex = sh.horaireToIndex(reunion.horaire),
            .missing = pro.pro,
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

fn FixedBuffer(comptime T: type, comptime N: u8) type {
    return struct {
        buffer: [N]T = @splat(undefined),
        len: u8 = 0,

        const Self = @This();

        fn push(self: *Self, check: T) void {
            self.buffer[self.len] = check;
            self.len += 1;
        }
    };
}

const ReposCheck = FixedBuffer(NotEnoughSleep, 4);

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
    try std.testing.expectEqual(ho(7, 15), diags.buffer[0].expectedLendemain);
}

// returns a shallow copy of `pros`, ordered according to
// ouverture matin soir fermeture
fn byPosition(comptime T: type, pros: [4]T, positions: [4]sh.Position) [4]T {
    return .{
        pros[std.mem.indexOfScalar(sh.Position, &positions, sh.Position.o) orelse 0],
        pros[std.mem.indexOfScalar(sh.Position, &positions, sh.Position.m) orelse 0],
        pros[std.mem.indexOfScalar(sh.Position, &positions, sh.Position.s) orelse 0],
        pros[std.mem.indexOfScalar(sh.Position, &positions, sh.Position.f) orelse 0],
    };
}

const WrongRoulement = struct {
    dayIndex: u8,
    expectedOrder: [4]sh.string,
    gotOrder: [4]sh.string,
};

const RoulementCheck = FixedBuffer(WrongRoulement, 5);

fn checkRoulements(week: sh.WeekPros, roulements: sh.Roulements) RoulementCheck {
    if (week.prosHoraires.len < 4) return RoulementCheck{}; // dont bother to guess

    const pros = week.prosHoraires[0..4];
    const expectedRoulement = roulements[week.roulement];

    const proIndex = struct {
        presence: sh.Range,
        index: u8,

        const Self = @This();

        // returns true if h1 < h2
        pub fn isLess(_: void, h1: Self, h2: Self) bool {
            return sh.Horaire.compare(h1.presence.start, h2.presence.start) == -1;
        }
    };

    var out = RoulementCheck{};
    for (0..5) |dayI| {
        // expected
        const exp = byPosition(u8, [_]u8{ 0, 1, 2, 3 }, expectedRoulement[dayI]);
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
        if (!std.mem.eql(u8, &exp, &got)) {
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
    const roulements0: sh.Roulements = &.{
        .{
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
        },
    };
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

    const roulements1: sh.Roulements = &.{
        .{
            .{ .m, .o, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .o, .m, .s, .f },
            .{ .s, .m, .o, .f },
            .{ .o, .m, .s, .f },
        },
    };
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
