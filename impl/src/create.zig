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

fn pauseDuration(dayDuration: sh.TimeIndex) u8 {
    if (dayDuration >= check.LargeDay) {
        return 60;
    } else if (dayDuration == check.MediumDay) {
        return 45;
    }
    return 30;
}

const HorairesBuffer = [pausesCombinationCount][4]sh.HoraireTravail;

// dayDurations are expressed in grid index, and in "rotation order"
// the returned slices are in "rotation order"
pub fn generateHorairesFromDurations(
    arrivals: check.Arrivals,
    dayDurations: Durations,
    out: *HorairesBuffer,
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
    const presence1 = sh.Range{ .start = ouverture, .end = fin1 };

    // matin
    const fin2 = sh.indexToHoraire(arrivals.secondArrival + dayDurations[1]);
    const presence2 = sh.Range{ .start = matin, .end = fin2 };

    // soir
    const debut3 = sh.indexToHoraire(arrivals.beforeLastGo + 1 - dayDurations[2]);
    const presence3 = sh.Range{ .start = debut3, .end = soir };

    // fermeture
    const debut4 = sh.indexToHoraire(arrivals.lastGo + 1 - dayDurations[3]);
    const presence4 = sh.Range{ .start = debut4, .end = fermeture };

    var i: usize = 0;
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

const Durations = [4]sh.TimeIndex;

fn compareDurations(_: void, a: Durations, b: Durations) bool {
    return a[0] + a[1] + a[2] + a[3] < (b[0] + b[1] + b[2] + b[3]);
}

fn allDurations(gpa: Allocator, min: sh.TimeIndex, max: sh.TimeIndex) std.ArrayList(Durations) {
    var buffer = std.ArrayList(Durations).initCapacity(gpa, 100) catch unreachable;

    var d1 = min;
    while (d1 <= max) : (d1 += 3) {
        var d2 = min;
        while (d2 <= max) : (d2 += 3) {
            var d3 = min;
            while (d3 <= max) : (d3 += 3) {
                var d4 = min;
                while (d4 <= max) : (d4 += 3) {
                    buffer.append(gpa, .{ d1, d2, d3, d4 }) catch unreachable;
                }
            }
        }
    }

    // try overall less work first
    std.mem.sortUnstable(Durations, buffer.items, {}, compareDurations);

    return buffer;
}

// return the length of valid horaires
fn computeValidHoraires(
    children: check.ChildrenCountDay,
    arrivals: check.Arrivals,
    detachements: [4](?sh.Detachement),
    reunionRange: ?sh.Range,
    durations: Durations,
    buffer: *HorairesBuffer,
) usize {
    // try every pauses ...
    generateHorairesFromDurations(arrivals, durations, buffer);

    // ... and check if we have (at least) a solution that satisifies every "day by day" checks
    var currentIndex: usize = 0;
    for (buffer) |candidate| {
        const pros = check.buildProsCountDay(&candidate, &detachements);
        const checkChildrenCount = check.checkChildrenCountDay(children, pros, reunionRange);

        const ok1 = checkChildrenCount == null;

        var ok2 = true;
        const proNoInterim: sh.Pro = .{ .prenom = "", .isInterimaire = false, .color = "" };
        for (candidate) |proHoraire| {
            const diag = check.checkPauseDay(proNoInterim, proHoraire);
            if (diag != null) {
                ok2 = false;
                break;
            }
        }
        if (ok1 and ok2) {
            buffer[currentIndex] = candidate;
            currentIndex += 1;
        }
    }

    return currentIndex;
}

fn overThresold(l: []const sh.TimeIndex, threshold: sh.TimeIndex) bool {
    for (l) |value| {
        if (value < threshold) {
            return false;
        }
    }
    return true;
}

pub fn generateDayHoraires(gpa: Allocator, children: check.ChildrenCountDay) [][4]sh.HoraireTravail {
    // TODO: maybe support
    const detachements: [4](?sh.Detachement) = .{ null, null, null, null };
    const reunionRange: ?sh.Range = null;

    const arrivals = check.expectedArrivals(&children);

    // start with "maximal" durations
    const maxDuration: sh.TimeIndex = 10 * 12 + 6; // 10h30
    const thresholdDuration: sh.TimeIndex = 8 * 12; // 8h
    const minDuration: sh.TimeIndex = 4 * 12; // 4h

    // For each pro, we have the follwing ranges :
    //    - under [mediumDay] or over [largeDay] : reducing duration only makes things worse
    //    - in between : it may be helpful to reduce work to also reduce pauses

    var selectedDurations: ?Durations = null;
    var selectedHoraires: [][4]sh.HoraireTravail = &.{};

    // we first brute-force search between thresholdDuration and maxDuration,
    // less work first
    var buffer: HorairesBuffer = @splat(@splat(.{ .presence = sh.Range.empty(), .pause = sh.Range.empty() }));

    var candidates = allDurations(gpa, thresholdDuration, maxDuration);
    defer candidates.deinit(gpa);

    std.debug.print("testing {} candidates\n", .{candidates.items.len});

    for (candidates.items) |durations| {
        const validHorairesLength = computeValidHoraires(children, arrivals, detachements, reunionRange, durations, &buffer);
        if (validHorairesLength != 0) {
            // we have found a first (list of) solution
            // save it, but try with the "under thresholdDuration" durations
            selectedDurations = durations;
            selectedHoraires = buffer[0..validHorairesLength];
            break;
        }
    }

    var selectedDurationsM = selectedDurations orelse return &.{}; // aie aie aie

    // now try to reduce work for duration under thresholdDuration
    // (other has been tried)
    var tmp = [4]usize{ 0, 0, 0, 0 };
    var prosToReduce = std.ArrayList(usize).initBuffer(&tmp);
    for (selectedDurationsM, 0..) |value, i| {
        if (value == thresholdDuration) {
            prosToReduce.appendBounded(i) catch unreachable;
        }
    }

    if (prosToReduce.items.len == 0) return selectedHoraires; // can't do better

    var proCursor: usize = 0;
    while (overThresold(&selectedDurationsM, minDuration)) {
        const validHorairesLength = computeValidHoraires(children, arrivals, detachements, reunionRange, selectedDurationsM, &buffer);

        if (validHorairesLength != 0) {
            selectedHoraires = buffer[0..validHorairesLength];
            // If we succeed, try with less work
            const indexToReduce = prosToReduce.items[proCursor % prosToReduce.items.len];
            selectedDurationsM[indexToReduce] -= 3;
            proCursor += 1;
        } else {
            break;
        }
    }

    // alloc and copy
    const out = gpa.alloc([4]sh.HoraireTravail, selectedHoraires.len) catch unreachable;
    @memcpy(out, selectedHoraires);

    return out;
}

test "selectDayHoraires Simple" {
    const gpa = std.testing.allocator;

    var childrenCount: check.ChildrenCountDay = @splat(check.ChildrenCount{});
    const t1 = sh.horaireToIndex(.{ .heure = 7, .minute = 0 });
    const t2 = sh.horaireToIndex(.{ .heure = 9, .minute = 0 });
    for (t1..t2) |timeI| {
        childrenCount[timeI] = .{ .marcheurCount = 5, .nonMarcheurCount = 5 };
    }
    const t3 = sh.horaireToIndex(.{ .heure = 13, .minute = 0 });
    const t4 = sh.horaireToIndex(.{ .heure = 15, .minute = 0 });
    for (t3..t4) |timeI| {
        childrenCount[timeI] = .{ .marcheurCount = 5, .nonMarcheurCount = 5 };
    }
    const out = generateDayHoraires(gpa, childrenCount);
    defer gpa.free(out);
    try std.testing.expectEqual(18, out.len);
}

test "selectDayHoraires Real" {
    const gpa = std.testing.allocator;

    const file = try std.fs.cwd().readFileAlloc(gpa, "testdata/children_0.json", std.math.maxInt(usize));
    defer gpa.free(file);
    const parsed = try std.json.parseFromSlice(sh.ChildrenPlanning, gpa, file, .{ .ignore_unknown_fields = true });
    defer parsed.deinit();
    var children: sh.ChildrenPlanning = parsed.value;

    const childrenCounts = check.buildChildrenCount(gpa, children);
    defer gpa.free(childrenCounts);
    try std.testing.expect(childrenCounts.len == 5);

    const out1 = generateDayHoraires(gpa, childrenCounts[0][3]);
    defer gpa.free(out1);
    try std.testing.expectEqual(2, out1.len);

    const out2 = generateDayHoraires(gpa, childrenCounts[1][0]);
    defer gpa.free(out2);
    try std.testing.expectEqual(1, out2.len);

    // add an adaptation
    if (children.children[4].creneaux[1][0]) |*ptr| {
        ptr.*.isAdaptation = true;
    }
    const childrenCounts2 = check.buildChildrenCount(gpa, children);
    defer gpa.free(childrenCounts2);

    const start = try std.time.Instant.now();

    const out3 = generateDayHoraires(gpa, childrenCounts2[1][0]);
    defer gpa.free(out3);
    try std.testing.expectEqual(1, out3.len);

    const end = try std.time.Instant.now();
    std.debug.print("Time spent {} ms\n", .{end.since(start) / 1000000});
}
