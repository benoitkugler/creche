const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");

const ChildrenCount = struct {
    adaptionCount: i16,
    marcheurCount: i16,
    nonMarcheurCount: i16,

    fn count(self: ChildrenCount) i16 {
        return self.adaptionCount + self.marcheurCount + self.nonMarcheurCount;
    }
};

pub const Arrivals = struct {
    firstArrival: sh.TimeIndex,
    secondArrival: sh.TimeIndex,
    beforeLastGo: sh.TimeIndex,
    lastGo: sh.TimeIndex,
};

fn firstIndex(children: []ChildrenCount, criteria: fn (ChildrenCount) bool) usize {
    for (children, 0..) |value, i| {
        if (criteria(value)) {
            return i;
        }
        return -1;
    }
}

fn lastIndex(children: []ChildrenCount, criteria: fn (ChildrenCount) bool) usize {
    var i: usize = children.len;
    while (i > 0) {
        i -= 1;
        const value = children[i];
        if (criteria(value)) {
            return i;
        }
    }
    return -1;
}

fn has1Child(c: ChildrenCount) bool {
    return c.count() > 0;
}
fn has4Children(c: ChildrenCount) bool {
    return c.count() >= 4;
}

pub fn expectedArrivals(children: []ChildrenCount) Arrivals {
    // first arrival
    const indexFirstChild = firstIndex(children, has1Child);

    if (indexFirstChild == -1) {
        return .{
            .firstArrival = -1,
            .secondArrival = -1,
            .beforeLastGo = -1,
            .lastGo = -1,
        };
    }

    const firstArrival = indexFirstChild - sh.minutesToIndex(15);

    // last go
    const indexLastChild = lastIndex(children, has1Child);
    const lastGo = indexLastChild + sh.minutesToIndex(30);

    // second arrival
    const indexFourthChild = firstIndex(children, has4Children);
    if (indexFourthChild == -1) {
        // never more than 3; nothing to check
        return .{
            .firstArrival = firstArrival,
            .secondArrival = -1,
            .beforeLastGo = -1,
            .lastGo = lastGo,
        };
    }

    const secondArrival = indexFourthChild - sh.minutesToIndex(15);

    // before last go
    const indexLastFourthChild = lastIndex(children, has4Children);
    const beforeLastGo = indexLastFourthChild + sh.minutesToIndex(15);

    return .{
        firstArrival,
        secondArrival,
        beforeLastGo,
        lastGo,
    };
}

const ProsCountDay = [sh.TimeGridLength]u8;

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
