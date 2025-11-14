const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");
const check = @import("check.zig");

const HorairesT4 = [4]sh.HoraireTravail;

const WeekHoraires = sh.WeekOf(HorairesT4);

const CreatePlanningError = error{ConstraintsNotResolved};

// `firstWeekRoulement` is the (0-based) index in `roulements` of the
//first week defined in `children`
pub fn createPlanning(gpa: Allocator, children: sh.ChildrenPlanning, roulements: sh.RoulementsAndPros, firstWeekRoulement: usize) !sh.ProsPlanning {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();

    const R = roulements.roulements.weeks.len;
    const childrenCounts = check.buildChildrenCount(arena.allocator(), children);

    // to simplify freeing memory on error allocate a temporary storage
    const BestWeek = struct { week: WeekHoraires, roulement: usize };
    var bestWeeks = try gpa.alloc(BestWeek, childrenCounts.len);
    defer gpa.free(bestWeeks);

    for (childrenCounts, 0..) |weekChildren, weekI| {
        const roulementI = (firstWeekRoulement + weekI) % R;
        const weekRoulement = roulements.roulements.weeks[roulementI];

        // for a given week, we compute all candidate for each day,
        // and we then choose the best week regarding to overall work duration
        var candidatesByDay: sh.WeekOf([]HorairesT4) = undefined;
        for (0..5) |dayI| {
            // std.debug.print("generating horaires for week {} day {}\n", .{ weekI, dayI });

            var dayCandidates = generateDayHoraires(arena.allocator(), weekChildren[dayI]);
            if (dayCandidates.len == 0) {
                return CreatePlanningError.ConstraintsNotResolved;
            }

            // std.debug.print("found {} configs\n", .{dayCandidates.len});

            // apply rotation from roulements
            const creneaux = weekRoulement[dayI];
            for (dayCandidates, 0..) |value, i| {
                dayCandidates[i] = .{
                    value[@intFromEnum(creneaux[0])],
                    value[@intFromEnum(creneaux[1])],
                    value[@intFromEnum(creneaux[2])],
                    value[@intFromEnum(creneaux[3])],
                };
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

        // printHoraires(&bestWeek);
        bestWeeks[weekI] = .{ .roulement = roulementI, .week = bestWeek };
    }

    var weeks = try gpa.alloc(sh.WeekPros, childrenCounts.len);
    for (bestWeeks, 0..) |value, weekI| {
        // convert to pro first
        const pros = try gpa.alloc(sh.WeekPro, 4);
        for (roulements.pros, 0..) |pro, i| {
            pros[i].pro = pro;
        }
        for (value.week, 0..) |day, dayI| {
            for (day, 0..) |h, proI| {
                pros[proI].horaires[dayI] = h;
            }
        }
        weeks[weekI] = sh.WeekPros{ .week = weekI, .prosHoraires = pros, .roulement = value.roulement, .reunion = null };
    }

    return .{ .firstMonday = children.firstMonday, .weeks = weeks };
}

fn printHoraires(l: []const HorairesT4) void {
    for (l) |value| {
        for (value) |pro| {
            std.debug.print("{s} ", .{pro.format()});
        }
        std.debug.print("\n", .{});
    }
}

test "createPlanning" {
    const gpa = std.testing.allocator;

    const parsedR = try loadJSON(sh.RoulementsAndPros, "testdata/roulements.json");
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
    var created0 = try createPlanning(gpa, children0, roulements, 1);
    defer created0.deinit(gpa);
    std.debug.print("Month 0, time spent {} ms\n\n", .{start.read() / 1000000});

    start = try std.time.Timer.start();
    var created1 = try createPlanning(gpa, children1, roulements, 1);
    defer created1.deinit(gpa);
    std.debug.print("Month 1, time spent {} ms\n\n", .{start.read() / 1000000});

    start = try std.time.Timer.start();
    var created2 = try createPlanning(gpa, children2, roulements, 2);
    defer created2.deinit(gpa);
    std.debug.print("Month 2, time spent {} ms\n\n", .{start.read() / 1000000});

    const diags0 = try check.checkPlanning(gpa, children0, created0, roulements.roulements);
    defer gpa.free(diags0);
    try assertCheckKind(diags0);

    const diags1 = try check.checkPlanning(gpa, children1, created1, roulements.roulements);
    defer gpa.free(diags1);
    try assertCheckKind(diags1);

    const diags2 = try check.checkPlanning(gpa, children2, created2, roulements.roulements);
    defer gpa.free(diags2);
    try assertCheckKind(diags2);
}

const Err = error{wrongCheck};
fn assertCheckKind(diags: []check.TimeCheck) !void {
    for (diags) |value| {
        switch (value.check) {
            // only check accepted
            .notEnoughSleep => {},
            else => {
                std.debug.print("at {any}, found {any}\n", .{ value.dayIndex, value.check });
                return Err.wrongCheck;
            },
        }
    }
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

const HorairesBuffer = [pausesCombinationCount]HorairesT4;

// dayDurations are expressed in grid index, and in "rotation order"
// the returned slices are in "rotation order"
// return an error if the computed start or end do not fit in
// the global time range.
pub fn generateHorairesFromDurations(
    arrivals: check.Arrivals,
    dayDurations: Durations,
    out: *HorairesBuffer,
) error{durationTooLarge}!void {
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

    // safety check for edge cases
    if (!(presence1.end.isValid() and presence2.end.isValid() and presence3.start.isValid() and presence4.start.isValid())) {
        return error.durationTooLarge;
    }

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

// always fully mutate [sratch]
// valid horaires are written in [out] and a slice of it is returned
fn computeValidHoraires(
    children: check.ChildrenCountDay,
    arrivals: check.Arrivals,
    detachements: [4](?sh.Detachement),
    reunionRange: ?sh.Range,
    durations: Durations,
    scratch: *HorairesBuffer,
    out: *HorairesBuffer,
) []const HorairesT4 {
    // try every pauses ...
    generateHorairesFromDurations(arrivals, durations, scratch) catch return &.{};

    // ... and check if we have (at least) a solution that satisifies every "day by day" checks
    var currentIndex: usize = 0;
    for (scratch) |candidate| {
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
            out[currentIndex] = candidate;
            currentIndex += 1;
        }
    }

    return out[0..currentIndex];
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
pub fn generateDayHoraires(gpa: Allocator, children: check.ChildrenCountDay) []HorairesT4 {
    // TODO: maybe support
    const detachements: [4](?sh.Detachement) = .{ null, null, null, null };
    const reunionRange: ?sh.Range = null;

    const arrivals = check.expectedArrivals(&children);

    // handle 0 children
    if (arrivals.firstArrival == sh.TimeIndexEmpty) {
        const out = gpa.alloc(HorairesT4, 1) catch unreachable;
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
    var selectedHoraires: []const HorairesT4 = &.{};

    // we first brute-force search between thresholdDuration and maxDuration,
    // less work first
    var scratch: HorairesBuffer = @splat(@splat(.{ .presence = sh.Range.empty(), .pause = sh.Range.empty() }));
    var validHoraires: HorairesBuffer = @splat(@splat(.{ .presence = sh.Range.empty(), .pause = sh.Range.empty() }));

    var candidates = allDurations(gpa, thresholdDuration, maxDuration);
    defer candidates.deinit(gpa);

    // std.debug.print("testing {} candidates\n", .{candidates.items.len});

    for (candidates.items) |durations| {
        const slice = computeValidHoraires(children, arrivals, detachements, reunionRange, durations, &scratch, &validHoraires);
        if (slice.len != 0) {
            // we have found a first (list of) solution
            // save it, but try with the "under thresholdDuration" durations
            selectedDurations = durations;
            selectedHoraires = slice;
            break;
        }
    }

    var selectedDurationsM = selectedDurations orelse return &.{}; // aie aie aie

    // now try to reduce work for duration under thresholdDuration
    // (other has been tried)
    var tmp = sh.FixedBuffer(usize, 4){};
    for (selectedDurationsM, 0..) |value, i| {
        if (value == thresholdDuration) {
            tmp.push(i);
        }
    }
    const prosToReduce = tmp.slice();

    if (prosToReduce.len != 0) {
        var proCursor: usize = 0;
        while (overThresold(&selectedDurationsM, minDuration)) {
            const slice = computeValidHoraires(children, arrivals, detachements, reunionRange, selectedDurationsM, &scratch, &validHoraires);

            if (slice.len != 0) {
                selectedHoraires = slice;
                // If we succeed, try with less work
                const indexToReduce = prosToReduce[proCursor % prosToReduce.len];
                selectedDurationsM[indexToReduce] -= 3;
                proCursor += 1;
            } else {
                break;
            }
        }
    }

    // alloc and copy
    return gpa.dupe(HorairesT4, selectedHoraires) catch unreachable;
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

    return try std.json.parseFromSlice(T, gpa, file, .{ .ignore_unknown_fields = true, .allocate = .alloc_always });
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

    std.debug.print("Week 1 day 0, time spent {} ms\n", .{start.read() / 1000000});
}
