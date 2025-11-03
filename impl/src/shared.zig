pub const Horaire = struct {
    heure: u8,
    minute: u8,
};

pub const Range = struct {
    start: Horaire,
    end: Horaire,

    fn fromDuration(start: Horaire, duration: i32) Range {
        const endInMinutes = start.heure * 60 + start.minute + duration;
        const endMinutes = (endInMinutes % 60);
        const endHour = ((endInMinutes - endMinutes) / 60);
        return Range(start, .{ .heure = endHour, .minute = endMinutes });
    }
};

pub const HoraireTravail = struct {
    presence: Range,
    pause: Range,
};

const HeureMin = 6; // inclus
const HeureMax = 22; // exclus

pub const TimeIndex = u16;

pub const TimeGridLength = 12 * (HeureMax - HeureMin);

pub fn minutesToIndex(m: u8) TimeIndex {
    return m / 5;
}

pub fn horaireToIndex(h: Horaire) TimeIndex {
    return (h.heure - HeureMin) * 12 + minutesToIndex(h.minute);
}

pub fn indexToHoraire(index: TimeIndex) Horaire {
    const heure = index / 12;
    const minute = index % 12;
    return .{
        .heure = (HeureMin + heure),
        .minute = (minute * 5),
    };
}
pub fn rangeToBounds(range: Range) [2]TimeIndex {
    return [2]TimeIndex{
        horaireToIndex(range.start),
        horaireToIndex(range.end) - 1,
    };
}

pub const Detachement = struct {
    dayIndex: u8,
    horaires: Range,
};
