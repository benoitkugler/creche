const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");
const check = @import("check.zig");

// heuristics for pauses :
// for ouverture, pause is at 10h, 10h30 or 11h
const pausesStart1 = [_]sh.Horaire{
    .{ .heure = 10, .minute = 0 },
    .{ .heure = 10, .minute = 30 },
    .{ .heure = 11, .minute = 0 },
};

// for matin, pause is either 10h30-11h, 11h-11h30 or at 13h
const pausesStart2 = [_]sh.Horaire{
    .{ .heure = 10, .minute = 30 },
    .{ .heure = 11, .minute = 0 },
    .{ .heure = 13, .minute = 0 },
};

// for soir, pause is between 13h30 and 14h30
const pausesStart3 = [_]sh.Horaire{
    .{ .heure = 13, .minute = 30 },
    .{ .heure = 13, .minute = 45 },
    .{ .heure = 14, .minute = 0 },
    .{ .heure = 14, .minute = 15 },
    .{ .heure = 14, .minute = 30 },
};

// for fermeture, pause is at 15h or 15h30
const pausesStart4 = [_]sh.Horaire{
    .{ .heure = 15, .minute = 0 },
    .{ .heure = 15, .minute = 30 },
};

const pausesCombinationCount =
    pausesStart1.len *
    pausesStart2.len *
    pausesStart3.len *
    pausesStart4.len;

// 8h30
const largeDay: sh.TimeIndex = 8 * 12 + 6;
// 8h15
const mediumDay: sh.TimeIndex = 8 * 12 + 3;

fn pauseDuration(dayDuration: sh.TimeIndex) u8 {
    if (dayDuration >= largeDay) {
        return 60;
    } else if (dayDuration == mediumDay) {
        return 45;
    }
    return 30;
}

// dayDurations are expressed in grid index, and in "rotation order"
// the returned slices are in "rotation order"
pub fn generateHorairesFromDurations(
    arrivals: check.Arrivals,
    dayDurations: [4]sh.TimeIndex,
    out: [pausesCombinationCount][4]sh.HoraireTravail,
) void {
    // TODO: handle less than 4 children

    // for each pro, there is 3 horaires to choose ;
    // - the "other" end of the day : defined by dayDurations
    // - the pause duration : defined by the day duration
    //    - 8h30 -> 1h
    //    - 8h15 -> 45min
    //    - 8h or less -> 30min
    // - the pause start

    const ouverture = sh.indexToHoraire(arrivals.firstArrival);
    const matin = sh.indexToHoraire(arrivals.secondArrival);
    const soir = sh.indexToHoraire(arrivals.beforeLastGo + 1); // arrivals is the last presence
    const fermeture = sh.indexToHoraire(arrivals.lastGo + 1); // arrivals is the last presence

    const pauseDuration1 = pauseDuration(dayDurations[0]);
    const pauseDuration2 = pauseDuration(dayDurations[1]);
    const pauseDuration3 = pauseDuration(dayDurations[2]);
    const pauseDuration4 = pauseDuration(dayDurations[3]);

    // ouverture
    const fin1 = sh.indexToHoraire(arrivals.firstArrival + dayDurations[0]);
    const presence1 = sh.Range(ouverture, fin1);

    // matin
    const fin2 = sh.indexToHoraire(arrivals.secondArrival + dayDurations[1]);
    const presence2 = sh.Range(matin, fin2);

    // soir
    const debut3 = sh.indexToHoraire(arrivals.beforeLastGo + 1 - dayDurations[2]);
    const presence3 = sh.Range(debut3, soir);

    // fermeture
    const debut4 = sh.indexToHoraire(arrivals.lastGo + 1 - dayDurations[3]);
    const presence4 = sh.Range(debut4, fermeture);

    var i = 0;
    for (pausesStart1) |pause1| {
        for (pausesStart2) |pause2| {
            for (pausesStart3) |pause3| {
                for (pausesStart4) |pause4| {
                    out[i] = .{
                        .{
                            .presence = presence1,
                            .pause = sh.Range.fromDuration(pause1, pauseDuration1),
                        },
                        .{
                            .presence = presence2,
                            .pause = sh.Range.fromDuration(pause2, pauseDuration2),
                        },
                        .{
                            .presence = presence3,
                            .pause = sh.Range.fromDuration(pause3, pauseDuration3),
                        },
                        .{
                            .presence = presence4,
                            .pause = sh.Range.fromDuration(pause4, pauseDuration4),
                        },
                    };
                    i += 1;
                }
            }
        }
    }
}

// const gpa  = std.heap.GeneralPurposeAllocator(.{}){};
// const allocator = gpa.allocator();
// var buffer = try std.ArrayList(u8)
//     .initCapacity(allocator, 100);
// defer buffer.deinit(allocator);

fn compareDurations(_: void, a: [4]sh.TimeIndex, b: [4]sh.TimeIndex) bool {
    return a[0] + a[1] + a[2] + a[3] <= (b[0] + b[1] + b[2] + b[3]);
}

fn allDurations(gpa: Allocator, min: sh.TimeIndex, max: sh.TimeIndex) std.ArrayList {
    var buffer = try std.ArrayList([4]sh.TimeIndex).initCapacity(gpa, 100);

    var d1, var d2, var d3, var d4 = .{ min, min, min, min };
    while (d1 <= max) : (d1 += 3) {
        while (d2 <= max) : (d2 += 3) {
            while (d3 <= max) : (d3 += 3) {
                while (d4 <= max) : (d4 += 3) {
                    buffer.append(gpa, .{ d1, d2, d3, d4 });
                }
            }
        }
    }

    // try overall less work first
    std.mem.sortUnstable([4]sh.TimeIndex, buffer.items, {}, compareDurations);

    return buffer;
}
