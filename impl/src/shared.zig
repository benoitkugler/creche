const std = @import("std");

pub const Horaire = struct {
    heure: u8,
    minute: u8,

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

pub const Range = struct {
    start: Horaire,
    end: Horaire,

    pub fn empty() Range {
        return .{ .start = .{ .heure = 0, .minute = 0 }, .end = .{ .heure = 0, .minute = 0 } };
    }

    pub fn fromDuration(start: Horaire, minutes: u16) Range {
        const endInMinutes = @as(u16, start.heure) * 60 + start.minute + minutes;
        const endMinutes: u8 = @intCast(endInMinutes % 60);
        const endHour: u8 = @intCast((endInMinutes - endMinutes) / 60);
        return Range{ .start = start, .end = .{ .heure = endHour, .minute = endMinutes } };
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
    pub fn duration(self: Range) u16 {
        const debutM = @as(u16, self.start.heure) * 60 + self.start.minute;
        const finM = @as(u16, self.end.heure) * 60 + self.end.minute;
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
};

const HeureMin = 6; // inclus
const HeureMax = 22; // exclus

pub const TimeIndex = u16;

pub const TimeIndexEmpty: TimeIndex = 0xFFFF;

pub const TimeGridLength = 12 * (HeureMax - HeureMin);

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

pub const Detachement = struct {
    dayIndex: u8,
    horaires: Range,
};

pub const string = []const u8;

pub const Pro = struct {
    prenom: string,
    color: string, // #HEX format
    isInterimaire: bool,
};

pub fn WeekOf(comptime T: type) type {
    return [5]T;
}

pub const Child = struct {
    nom: string,
    dateNaissance: string, // maybe empty
    isMarcheur: bool,
};

pub const ChildDay = struct {
    horaires: Range,
    isAdaptation: bool,
};

pub const ChildCreneaux = struct {
    child: Child,
    creneaux: []WeekOf(?ChildDay),
};

pub const ChildrenPlanning = struct {
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
    roulement: u8, // index 0-based (entre 0 et 3) du roulement pour cette semaine
    reunion: ?Reunion = null,
};

pub const ProsPlanning = struct {
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
};

pub const Creneau = enum { o, m, s, f };

pub const Roulements = struct {
    weeks: []const WeekOf([4]Creneau),
};

pub const DayIndex = struct {
    week: usize,
    day: u8,
};
