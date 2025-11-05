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

pub const Arrivals = struct {
    firstArrival: sh.TimeIndex,
    secondArrival: sh.TimeIndex,
    beforeLastGo: sh.TimeIndex,
    lastGo: sh.TimeIndex,
};

fn firstIndex(children: []const ChildrenCount, criteria: fn (ChildrenCount) bool) ?usize {
    for (children, 0..) |value, i| {
        if (criteria(value)) {
            return i;
        }
    }
    return null;
}

fn lastIndex(children: []const ChildrenCount, criteria: fn (ChildrenCount) bool) ?usize {
    var i: usize = children.len;
    while (i > 0) {
        i -= 1;
        const value = children[i];
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
    const indexFirstChild = firstIndex(children, has1Child) orelse return .{
        .firstArrival = 0,
        .secondArrival = 0,
        .beforeLastGo = 0,
        .lastGo = 0,
    };

    const firstArrival: sh.TimeIndex = @intCast(indexFirstChild - sh.minutesToIndex(15));

    // last go
    const indexLastChild = lastIndex(children, has1Child) orelse unreachable;
    const lastGo: sh.TimeIndex = @intCast(indexLastChild + sh.minutesToIndex(30));

    // second arrival
    const indexFourthChild = firstIndex(children, has4Children) orelse return .{
        // never more than 3; nothing to check
        .firstArrival = firstArrival,
        .secondArrival = firstArrival,
        .beforeLastGo = lastGo,
        .lastGo = lastGo,
    };

    const secondArrival: sh.TimeIndex = @intCast(indexFourthChild - sh.minutesToIndex(15));

    // before last go
    const indexLastFourthChild = lastIndex(children, has4Children) orelse unreachable;
    const beforeLastGo: sh.TimeIndex = @intCast(indexLastFourthChild + sh.minutesToIndex(15));

    return .{
        .firstArrival = firstArrival,
        .secondArrival = secondArrival,
        .beforeLastGo = beforeLastGo,
        .lastGo = lastGo,
    };
}

pub const ProsCountDay = [sh.TimeGridLength]u8;
pub const ChildrenCountDay = [sh.TimeGridLength]ChildrenCount;

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

const ChildrenCountCheck = struct {
    gotProsCount: u16,
    expectedProsCount: u16,
    adaptationCount: u16,
};

fn checkChildrenCount(enfants: ChildrenCount, pros_: u16) ?ChildrenCountCheck {
    const marcheursParPro = 8;
    const nonMarcheursParPro = 5;

    // adaption requires a full pro
    if (enfants.adaptionCount > pros_) {
        return ChildrenCountCheck{
            .gotProsCount = pros_,
            .expectedProsCount = enfants.adaptionCount,
            .adaptationCount = enfants.adaptionCount,
        };
    }

    const pros = pros_ - enfants.adaptionCount;

    // special case for 1 pro
    if (pros <= 1) {
        if (enfants.marcheurCount + enfants.nonMarcheurCount > 3) {
            return ChildrenCountCheck{
                .gotProsCount = pros,
                .expectedProsCount = 2,
                .adaptationCount = enfants.adaptionCount,
            };
        }
    }

    // attribute the non Marcheurs, and fill with marcheurs
    const prosForNonMarcheurs = std.math.divCeil(u16, enfants.nonMarcheurCount, nonMarcheursParPro) catch 0;
    const nonCompleteNonMarcheurs = enfants.nonMarcheurCount % nonMarcheursParPro;

    var marcheursToAttribute = enfants.marcheurCount;
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
            .adaptationCount = enfants.adaptionCount,
        };
    }

    // all good !
    return null;
}

fn ec(adaptionCount: u16, marcheurCount: u16, nonMarcheurCount: u16) ChildrenCount {
    return ChildrenCount{ .adaptionCount = adaptionCount, .marcheurCount = marcheurCount, .nonMarcheurCount = nonMarcheurCount };
}

test "check children count" {
    try std.testing.expect(checkChildrenCount(ec(0, 0, 0), 0) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 0, 0), 1) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 0, 0), 3) == null);

    try std.testing.expect(checkChildrenCount(ec(0, 2, 1), 1) == null);
    try std.testing.expect(checkChildrenCount(ec(0, 4, 0), 1) != null);
    try std.testing.expect(checkChildrenCount(ec(0, 2, 2), 1) != null);

    try std.testing.expect(checkChildrenCount(ec(2, 0, 0), 1) != null);
    try std.testing.expect(checkChildrenCount(ec(1, 3, 0), 3) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 16, 0), 3) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 17, 0), 3) != null);
    try std.testing.expect(checkChildrenCount(ec(1, 0, 6), 3) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 0, 7), 3) == null);
    try std.testing.expect(checkChildrenCount(ec(1, 0, 11), 3) != null);
    try std.testing.expect(checkChildrenCount(ec(1, 2, 4), 3) == null);
    try std.testing.expect(checkChildrenCount(ec(0, 5, 6), 2) != null);

    try std.testing.expect(checkChildrenCount(ec(0, 5, 5), 2) == null);

    try std.testing.expect(checkChildrenCount(ec(0, 0, 9), 2) == null);
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

test "checkPauseDay" {
    const pro = sh.Pro{
        .prenom = "Audrey",
        .color = "#FFFFFF",
        .isInterimaire = false,
    };
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(6, 0), ho(7, 0)),
        .pause = sh.Range.empty(),
    }) == null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(6, 0), ho(11, 45)),
        .pause = sh.Range.empty(),
    }) == null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(6, 0), ho(12, 0)),
        .pause = sh.Range.empty(),
    }) != null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(11, 0), ho(14, 0)),
        .pause = sh.Range.empty(),
    }) != null);
    try std.testing.expect(checkPauseDay(pro, .{
        .presence = r(ho(13, 0), ho(14, 0)),
        .pause = sh.Range.empty(),
    }) == null);

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
