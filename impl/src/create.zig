const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");
const check = @import("check.zig");

const WeekHoraires = sh.WeekOf([4]sh.HoraireTravail);

pub const CreatedWeek = struct {
    roulement: usize,
    horaires: WeekHoraires,
};

pub const CreatedPlanning = struct {
    weeks: []const CreatedWeek,
};

const CreatePlanningError = error{ConstraintsNotResolved};

// `firstWeekRoulement` is the (0-based) index in `roulements` of the
//first week defined in `children`
pub fn createPlanning(gpa: Allocator, children: sh.ChildrenPlanning, roulements: sh.Roulements, firstWeekRoulement: usize) !CreatedPlanning {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();

    const R = roulements.weeks.len;
    const childrenCounts = check.buildChildrenCount(arena.allocator(), children);

    var weeks = try gpa.alloc(CreatedWeek, childrenCounts.len);

    for (childrenCounts, 0..) |weekChildren, weekI| {
        const roulementI = (firstWeekRoulement + weekI) % R;
        const weekRoulement = roulements.weeks[roulementI];

        // for a given week, we compute all candidate for each day,
        // and we then choose the best week regarding to overall work duration
        var candidatesByDay: sh.WeekOf([][4]sh.HoraireTravail) = undefined;
        for (0..5) |dayI| {
            // std.debug.print("generating horaires for week {} day {}\n", .{ weekI, dayI });

            var dayCandidates = generateDayHoraires(arena.allocator(), weekChildren[dayI]);
            if (dayCandidates.len == 0) {
                return CreatePlanningError.ConstraintsNotResolved;
            }

            // apply rotation from roulements
            for (dayCandidates, 0..) |value, i| {
                dayCandidates[i] = check.sortByCreneau(sh.HoraireTravail, value, weekRoulement[dayI]);
            }

            candidatesByDay[dayI] = dayCandidates;
        }

        // std.debug.print("selecting best horaires for week {}\n", .{weekI});

        var bestWeek: WeekHoraires = undefined;
        var bestDist: u32 = std.math.maxInt(u32);
        for (candidatesByDay[0]) |d0| {
            for (candidatesByDay[1]) |d1| {
                for (candidatesByDay[2]) |d2| {
                    for (candidatesByDay[3]) |d3| {
                        for (candidatesByDay[4]) |d4| {
                            const week: WeekHoraires = .{ d0, d1, d2, d3, d4 };
                            const workDurations = weekTravailDuration(week);
                            const dist = distanceIdealWorkDuration(workDurations);
                            if (dist < bestDist) {
                                bestWeek = week;
                                bestDist = dist;
                            }
                        }
                    }
                }
            }
        }

        weeks[weekI] = CreatedWeek{ .roulement = roulementI, .horaires = bestWeek };
    }

    return .{ .weeks = weeks };
}

test "createPlanning" {
    const gpa = std.testing.allocator;

    const parsedR = try loadJSON(sh.Roulements, "testdata/roulements.json");
    defer parsedR.deinit();
    const roulements = parsedR.value;

    const parsedC0 = try loadJSON(sh.ChildrenPlanning, "testdata/children_0.json");
    defer parsedC0.deinit();
    const children0 = parsedC0.value;

    const parsedC1 = try loadJSON(sh.ChildrenPlanning, "testdata/children_1.json");
    defer parsedC1.deinit();
    const children1 = parsedC1.value;

    const parsedC2 = try loadJSON(sh.ChildrenPlanning, "testdata/children_2.json");
    defer parsedC2.deinit();
    const children2 = parsedC2.value;

    // add an adaptation
    if (children0.children[4].creneaux[1][0]) |*ptr| {
        ptr.*.isAdaptation = true;
    }

    var start = try std.time.Timer.start();
    const created0 = try createPlanning(gpa, children0, roulements, 1);
    defer gpa.free(created0.weeks);
    std.debug.print("Month 0, time spent {} ms\n\n", .{start.read() / 1000000});
    try std.testing.expectEqual(.{ 1935, 2025, 1965, 2070 }, weekTravailDuration(created0.weeks[0].horaires));

    start = try std.time.Timer.start();
    const created1 = try createPlanning(gpa, children1, roulements, 1);
    defer gpa.free(created1.weeks);
    std.debug.print("Month 1, time spent {} ms\n\n", .{start.read() / 1000000});

    start = try std.time.Timer.start();
    const created2 = try createPlanning(gpa, children2, roulements, 2);
    defer gpa.free(created2.weeks);
    std.debug.print("Month 2, time spent {} ms\n\n", .{start.read() / 1000000});
}

// lower is better
fn distanceIdealWorkDuration(gots: [4]u32) u32 {
    var out: u32 = 0;
    for (gots) |got| {
        const exp: u32 = 35 * 60; // 35H
        if (got > exp) {
            out += got - exp;
        } else {
            out += exp - got;
        }
    }
    return out;
}

// return duration in minutes
fn weekTravailDuration(days: WeekHoraires) [4]u32 {
    var proDurations = [4]u32{ 0, 0, 0, 0 };
    for (days) |day| {
        for (day, 0..) |horaires, pro| {
            proDurations[pro] += horaires.workDuration();
        }
    }
    return proDurations;
}

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
    // for each pro, there is 3 horaires to choose ;
    // - the "other" end of the day : defined by dayDurations
    // - the pause duration : defined by the day duration
    //    - 8h30 -> 1h
    //    - 8h15 -> 45min
    //    - 8h or less -> 30min
    // - the pause start

    // for 3 or less children, the "second" and "first" pro are optionnal
    // fix the second arrival to 8h30 and the third depart to 18h30
    const isLess3 = arrivals.secondArrival == sh.TimeIndexEmpty;

    const ouverture = sh.indexToHoraire(arrivals.firstArrival);
    const matin = if (isLess3) sh.Horaire{ .heure = 8, .minute = 30 } else sh.indexToHoraire(arrivals.secondArrival);
    const soir = if (isLess3) sh.Horaire{ .heure = 18, .minute = 30 } else sh.indexToHoraire(arrivals.beforeLastGo + 1); // arrivals is the last presence
    const fermeture = sh.indexToHoraire(arrivals.lastGo + 1); // arrivals is the last presence

    const pauseDuration1 = pauseDuration(dayDurations[0]);
    const pauseDuration2 = pauseDuration(dayDurations[1]);
    const pauseDuration3 = pauseDuration(dayDurations[2]);
    const pauseDuration4 = pauseDuration(dayDurations[3]);

    // ouverture
    const presence1 = sh.Range.fromDuration(ouverture, sh.indexToMinutes(dayDurations[0]));

    // matin
    const presence2 = sh.Range.fromDuration(matin, sh.indexToMinutes(dayDurations[1]));

    // soir
    const presence3 = sh.Range.fromDurationEnd(soir, sh.indexToMinutes(dayDurations[2]));

    // fermeture
    const presence4 = sh.Range.fromDurationEnd(fermeture, sh.indexToMinutes(dayDurations[3]));

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

// return horaires passing children count and pauses checks;
pub fn generateDayHoraires(gpa: Allocator, children: check.ChildrenCountDay) [][4]sh.HoraireTravail {
    // TODO: maybe support
    const detachements: [4](?sh.Detachement) = .{ null, null, null, null };
    const reunionRange: ?sh.Range = null;

    const arrivals = check.expectedArrivals(&children);

    // handle 0 children
    if (arrivals.firstArrival == sh.TimeIndexEmpty) {
        const out = gpa.alloc([4]sh.HoraireTravail, 1) catch unreachable;
        out[0] = @splat(sh.HoraireTravail{ .presence = sh.Range.empty(), .pause = sh.Range.empty() });
        return out;
    }

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

    // std.debug.print("testing {} candidates\n", .{candidates.items.len});

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

fn loadJSON(comptime T: type, path: sh.string) !std.json.Parsed(T) {
    const gpa = std.testing.allocator;

    const file = try std.fs.cwd().readFileAlloc(gpa, path, std.math.maxInt(usize));
    defer gpa.free(file);
    return try std.json.parseFromSlice(T, gpa, file, .{ .ignore_unknown_fields = true });
}

test "selectDayHoraires Real" {
    const gpa = std.testing.allocator;
    const parsed = try loadJSON(sh.ChildrenPlanning, "testdata/children_0.json");
    defer parsed.deinit();
    var children = parsed.value;

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

    var start = try std.time.Timer.start();

    const out3 = generateDayHoraires(gpa, childrenCounts2[1][0]);
    defer gpa.free(out3);
    try std.testing.expectEqual(1, out3.len);

    std.debug.print("Time spent {} ms\n", .{start.read() / 1000000});
}
