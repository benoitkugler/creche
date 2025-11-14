const std = @import("std");
const Allocator = std.mem.Allocator;

pub fn FixedBuffer(comptime T: type, comptime N: u8) type {
    return struct {
        buffer: [N]T = @splat(undefined),
        len: u8 = 0,

        const Self = @This();

        pub fn push(self: *Self, v: T) void {
            self.buffer[self.len] = v;
            self.len += 1;
        }

        pub fn slice(self: *const Self) []const T {
            return self.buffer[0..self.len];
        }
    };
}

pub const Horaire = struct {
    heure: u8 = 0,
    minute: u8 = 0,

    fn fromDuration(minutes: u16) Horaire {
        const outMinutes: u8 = @intCast(minutes % 60);
        const outHour: u8 = @intCast((minutes - outMinutes) / 60);
        return .{ .heure = outHour, .minute = outMinutes };
    }

    pub fn format(h: Horaire) [5]u8 {
        var buffer: [5]u8 = undefined;
        _ = std.fmt.bufPrint(&buffer, "{:0>2}:{:0>2}", .{ h.heure, h.minute }) catch unreachable;
        return buffer;
    }

    // add a number of minutes and return a new horaire
    pub fn addDuration(self: Horaire, d: u16) Horaire {
        const outInMinutes = @as(u16, self.heure) * 60 + self.minute + d;
        return Horaire.fromDuration(outInMinutes);
    }

    // substract a number of minutes and return a new horaire
    // panics if d is too large
    pub fn subDuration(self: Horaire, d: u16) Horaire {
        const outInMinutes = @as(u16, self.heure) * 60 + self.minute - d;
        return Horaire.fromDuration(outInMinutes);
    }

    // returns true if h1 <= h2
    pub fn isBefore(h1: Horaire, h2: Horaire) bool {
        return compare(h1, h2) != 1;
    }

    pub fn compare(h1: Horaire, h2: Horaire) i8 {
        if (h1.heure < h2.heure) return -1;
        if (h1.heure > h2.heure) return 1;
        if (h1.minute < h2.minute) return -1;
        if (h1.minute > h2.minute) return 1;
        return 0;
    }
};

test "Horaire.format" {
    try std.testing.expectEqualStrings("01:01", &(Horaire{ .heure = 1, .minute = 1 }).format());
    try std.testing.expectEqualStrings("11:55", &(Horaire{ .heure = 11, .minute = 55 }).format());
}

pub const Range = struct {
    start: Horaire,
    end: Horaire,

    pub fn empty() Range {
        return .{ .start = .{}, .end = .{} };
    }

    pub fn fromDuration(start: Horaire, minutes: u16) Range {
        return Range{ .start = start, .end = start.addDuration(minutes) };
    }

    // compute start by substracting minutes to end
    pub fn fromDurationEnd(end: Horaire, minutes: u16) Range {
        return Range{ .start = end.subDuration(minutes), .end = end };
    }

    pub fn isEmpty(self: Range) bool {
        return Horaire.isBefore(self.end, self.start);
    }

    pub fn contains(self: Range, horaire: Horaire) bool {
        if (self.isEmpty()) return false;
        return Horaire.isBefore(self.start, horaire) and Horaire.isBefore(horaire, self.end);
    }

    // returns true if other is (fully) included in this range.
    pub fn includes(self: Range, other: Range) bool {
        if (other.isEmpty()) return true;
        return Horaire.isBefore(self.start, other.start) and Horaire.isBefore(other.end, self.end);
    }

    // returns true is the intersection is non empty
    pub fn overlaps(self: Range, other: Range) bool {
        const intersection = Range{
            .start = if (Horaire.isBefore(self.start, other.start)) other.start else self.start,
            .end = if (Horaire.isBefore(self.end, other.end)) self.end else other.end,
        };
        return !intersection.isEmpty();
    }

    // renvoie la durée en minutes
    pub fn duration(self: Range) u32 {
        const debutM = @as(u32, self.start.heure) * 60 + self.start.minute;
        const finM = @as(u32, self.end.heure) * 60 + self.end.minute;
        if (debutM > finM) return 0;
        return finM - debutM;
    }

    pub fn bounds(range: Range) [2]TimeIndex {
        if (range.isEmpty()) {
            return [2]TimeIndex{ 0, 0 };
        }
        return [2]TimeIndex{
            horaireToIndex(range.start),
            horaireToIndex(range.end),
        };
    }
};

fn ho(h: u8, m: u8) Horaire {
    return .{ .heure = h, .minute = m };
}

fn r(start: Horaire, end: Horaire) Range {
    return .{ .start = start, .end = end };
}

test "range duration" {
    try std.testing.expect(r(ho(6, 0), ho(6, 45)).duration() == 45);
    try std.testing.expect(r(ho(6, 0), ho(7, 0)).duration() == 60);
    try std.testing.expect(r(ho(6, 15), ho(7, 0)).duration() == 45);
    try std.testing.expect(r(ho(6, 15), ho(7, 5)).duration() == 50);
    try std.testing.expect(r(ho(6, 0), ho(8, 0)).duration() == 120);
    try std.testing.expect(r(ho(7, 0), ho(7, 0)).duration() == 0);
}

test "range overlaps" {
    try std.testing.expect(r(ho(6, 0), ho(6, 45)).overlaps(r(ho(6, 0), ho(6, 45))) == true);
    try std.testing.expect(r(ho(6, 0), ho(7, 0)).overlaps(r(ho(6, 0), ho(7, 30))) == true);
    try std.testing.expect(r(ho(6, 15), ho(7, 0)).overlaps(r(ho(6, 15), ho(6, 30))) == true);
    try std.testing.expect(r(ho(6, 15), ho(7, 5)).overlaps(r(ho(6, 0), ho(6, 30))) == true);
    try std.testing.expect(r(ho(6, 15), ho(7, 5)).overlaps(r(ho(6, 0), ho(6, 15))) == false);
    try std.testing.expect(r(ho(6, 15), ho(7, 5)).overlaps(r(ho(7, 5), ho(7, 15))) == false);
}

test "range from duration" {
    try std.testing.expectEqual(Range.fromDuration(ho(6, 30), 20).end, ho(6, 50));
    try std.testing.expectEqual(Range.fromDuration(ho(6, 30), 40).end, ho(7, 10));
    try std.testing.expectEqual(Range.fromDuration(ho(6, 30), 150).end, ho(9, 0));
}

pub const HoraireTravail = struct {
    presence: Range,
    pause: Range,

    // returns the work duration, that is excluding pause,
    // assuming pause is included in presence
    pub fn workDuration(self: HoraireTravail) u32 {
        return self.presence.duration() - self.pause.duration();
    }

    const fmtStr = "{s}>{s} ({s} {s})";
    const L = fmtStr.len + 4 * (5 - 3);
    pub fn format(self: HoraireTravail) [L]u8 {
        var buffer: [L]u8 = undefined;
        _ = std.fmt.bufPrint(&buffer, fmtStr, .{ self.presence.start.format(), self.presence.end.format(), self.pause.start.format(), self.pause.end.format() }) catch unreachable;
        return buffer;
    }
};

test "HoraireTravail.workDuration" {
    try std.testing.expectEqual(30, (HoraireTravail{ .presence = r(ho(8, 0), ho(9, 0)), .pause = r(ho(8, 15), ho(8, 45)) }).workDuration());
    try std.testing.expectEqual(0, (HoraireTravail{ .presence = r(ho(8, 0), ho(9, 0)), .pause = r(ho(8, 0), ho(9, 0)) }).workDuration());
    try std.testing.expectEqual(75, (HoraireTravail{ .presence = r(ho(8, 0), ho(10, 30)), .pause = r(ho(8, 30), ho(9, 45)) }).workDuration());
}

const HeureMin = 6; // inclus
const HeureMax = 22; // exclus

pub const TimeIndex = u16;

pub const TimeIndexEmpty: TimeIndex = 0xFFFF;

pub const TimeGridLength = 12 * (HeureMax - HeureMin);

pub fn indexToMinutes(t: TimeIndex) u16 {
    return t * 5;
}

pub fn minutesToIndex(m: u8) TimeIndex {
    return m / 5;
}

pub fn horaireToIndex(h: Horaire) TimeIndex {
    return (h.heure - HeureMin) * 12 + minutesToIndex(h.minute);
}

pub fn indexToHoraire(index: TimeIndex) Horaire {
    const heure: u8 = @intCast(index / 12);
    const minute: u8 = @intCast(index % 12);
    return .{
        .heure = (HeureMin + heure),
        .minute = (minute * 5),
    };
}

// ISO string representation of a Date
pub const Date = string;
pub const defaultDateTag = "2000-01-01T00:00:00.000Z";

pub const Detachement = struct {
    dayIndex: u8,
    horaires: Range,
};

pub const string = []const u8;

pub const Pro = struct {
    prenom: string = "",
    color: string = "", // #HEX format
    isInterimaire: bool = false,
};

pub fn WeekOf(comptime T: type) type {
    return [5]T;
}

pub const Child = struct {
    nom: string = "",
    dateNaissance: string = "", // maybe empty
    isMarcheur: bool = false,
};

pub const ChildDay = struct {
    horaires: Range,
    isAdaptation: bool = false,
};

pub const ChildCreneaux = struct {
    child: Child,
    creneaux: []WeekOf(?ChildDay),
};

pub const ChildrenPlanning = struct {
    firstMonday: Date = defaultDateTag,
    children: []ChildCreneaux,
    weekCount: usize,
};

pub const WeekPro = struct {
    pro: Pro,
    horaires: WeekOf(HoraireTravail),
    detachement: ?Detachement = null,
};

pub const Reunion = struct {
    day: u8,
    horaire: Horaire, // la durée est toujours d'une heure

    pub fn range(self: Reunion) Range {
        return Range{ .start = self.horaire, .end = Horaire{
            .heure = self.horaire.heure + 1,
            .minute = self.horaire.minute,
        } };
    }
};

pub const WeekPros = struct {
    week: usize, // index (0 based) par rapport au tableau des enfants
    prosHoraires: []const WeekPro, // pour chaque pro
    roulement: usize, // index 0-based (typiquement entre 0 et 3) du roulement pour cette semaine
    reunion: ?Reunion = null,

    fn deinit(self: *const WeekPros, gpa: Allocator) void {
        gpa.free(self.prosHoraires);
    }
};

pub const ProsPlanning = struct {
    firstMonday: Date = defaultDateTag,
    weeks: []const WeekPros,

    pub fn weekCount(input: ProsPlanning) usize {
        var max: usize = 0;
        for (input.weeks) |week| {
            if (week.week > max) {
                max = week.week;
            }
        }
        return max + 1;
    }

    pub fn deinit(self: *ProsPlanning, gpa: Allocator) void {
        for (self.weeks, 0..) |_, i| {
            self.weeks[i].deinit(gpa);
        }
        gpa.free(self.weeks);
    }
};

pub const Creneau = enum(u8) { o, m, s, f };

/// returns the pros indices in the order defined by `creneaux`.
///
/// For instance :
///     creneauxOrder(.{o, m, s, f}) == {0, 1, 2, 3}
///     creneauxOrder(.{m, s, o, f}) == {2, 0, 1, 3}
pub fn creneauxOrder(creneaux: [4]Creneau) [4]usize {
    const o = std.mem.indexOfScalar(Creneau, &creneaux, Creneau.o) orelse 0;
    const m = std.mem.indexOfScalar(Creneau, &creneaux, Creneau.m) orelse 0;
    const s = std.mem.indexOfScalar(Creneau, &creneaux, Creneau.s) orelse 0;
    const f = std.mem.indexOfScalar(Creneau, &creneaux, Creneau.f) orelse 0;
    return .{ o, m, s, f };
}

test "creneauxOrder" {
    try std.testing.expectEqual([_]usize{ 0, 1, 2, 3 }, creneauxOrder(.{ .o, .m, .s, .f }));
    try std.testing.expectEqual([_]usize{ 2, 0, 1, 3 }, creneauxOrder(.{ .m, .s, .o, .f }));
}

pub const Roulements = struct {
    weeks: []const WeekOf([4]Creneau),
};

pub const RoulementsAndPros = struct {
    pros: [4]Pro,
    roulements: Roulements,
};

pub const DayIndex = struct {
    week: usize = 0,
    day: u8 = 0,
};
