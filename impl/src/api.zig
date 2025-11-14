const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");
const check = @import("check.zig");
const create = @import("create.zig");

const SlicePtr = packed struct(u64) {
    len: u32,
    ptr: u32,

    fn toInt(slice: []u8) u64 {
        return @bitCast(SlicePtr{
            .len = @intCast(slice.len),
            .ptr = @intCast(@intFromPtr(slice.ptr)),
        });
    }
};

pub const CheckIn = struct {
    children: sh.ChildrenPlanning,
    pros: sh.ProsPlanning,
    roulements: ?sh.Roulements,
};

pub fn checkPlanning(gpa: Allocator, jsonPtr: [*]u8, jsonLen: usize) ![]u8 {
    const parsed: std.json.Parsed(CheckIn) = try std.json.parseFromSlice(CheckIn, gpa, jsonPtr[0..jsonLen], .{});
    defer parsed.deinit();
    const input = parsed.value;

    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const checks = try check.checkPlanning(arena.allocator(), input.children, input.pros, input.roulements);
    const out = try check.Diagnostic.buildSlice(arena.allocator(), checks);

    // build json output string
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();
    try std.json.Stringify.value(out, .{}, &buffer.writer);

    return buffer.toOwnedSlice();
}

test "check" {
    const gpa = std.testing.allocator;
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();

    try std.json.Stringify.value(CheckIn{
        .children = .{ .children = &[_]sh.ChildCreneaux{}, .weekCount = 0 },
        .pros = .{ .weeks = &[_]sh.WeekPros{} },
        .roulements = null,
    }, .{}, &buffer.writer);
    const jsonIn = buffer.written();

    std.debug.print("const jsonIn = '{s}'\n", .{jsonIn});

    const out = try checkPlanning(gpa, jsonIn.ptr, jsonIn.len);
    defer gpa.free(out);
}

pub const CreateIn = struct {
    children: sh.ChildrenPlanning,
    roulements: sh.RoulementsAndPros,
    firstWeekRoulement: usize,
};

pub const CreateOut = union(enum) {
    done: sh.ProsPlanning,
    err: sh.string,
};

pub fn createPlanning(gpa: Allocator, jsonPtr: [*]u8, jsonLen: usize) ![]u8 {
    const parsed: std.json.Parsed(CreateIn) = try std.json.parseFromSlice(CreateIn, gpa, jsonPtr[0..jsonLen], .{ .allocate = .alloc_always });
    defer parsed.deinit();
    const input = parsed.value;

    const outOrErr = create.createPlanning(gpa, input.children, input.roulements, input.firstWeekRoulement);

    var out: CreateOut = undefined;
    if (outOrErr) |planning| {
        out = .{ .done = planning };
    } else |err| {
        switch (err) {
            error.ConstraintsNotResolved => {
                out = .{ .err = "Impossible de résoudre les contraintes." };
            },
            else => {
                out = .{ .err = "Erreur imprévue." };
            },
        }
    }

    // build json output string
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();

    try std.json.Stringify.value(out, .{}, &buffer.writer);

    switch (out) {
        .done => |val| {
            val.deinit(gpa);
        },
        else => {},
    }

    return buffer.toOwnedSlice();
}

test "create" {
    const gpa = std.testing.allocator;
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();

    try std.json.Stringify.value(CreateIn{
        .children = .{ .children = &[_]sh.ChildCreneaux{}, .weekCount = 0 },
        .roulements = .{
            .pros = @splat(sh.Pro{}),
            .roulements = .{ .weeks = &[_]sh.WeekOf([4]sh.Creneau){} },
        },
        .firstWeekRoulement = 0,
    }, .{}, &buffer.writer);
    const jsonIn = buffer.written();

    std.debug.print("const jsonIn = '{s}'\n", .{jsonIn});

    const out = try createPlanning(gpa, jsonIn.ptr, jsonIn.len);
    defer gpa.free(out);

    std.debug.print("{s}\n", .{out});
}

test "createReal" {
    const gpa = std.testing.allocator;

    const file = try std.fs.cwd().readFileAlloc(gpa, "testdata/create_in.json", std.math.maxInt(usize));
    defer gpa.free(file);

    const out = try createPlanning(gpa, file.ptr, file.len);
    defer gpa.free(out);

    std.debug.print("{}\n", .{out.len});
}

test "createError" {
    const gpa = std.testing.allocator;
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();

    const child = sh.ChildCreneaux{ .child = .{}, .creneaux = @constCast(&[_]sh.WeekOf(?sh.ChildDay){
        .{ sh.ChildDay{ .horaires = sh.Range{ .start = .{ .heure = 10 }, .end = .{ .heure = 15 } }, .isAdaptation = true }, null, null, null, null },
    }) };
    try std.json.Stringify.value(CreateIn{
        .children = .{
            .children = @constCast(&[_]sh.ChildCreneaux{ child, child, child, child, child }),
            .weekCount = 1,
        },
        .roulements = .{
            .pros = @splat(sh.Pro{}),
            .roulements = .{ .weeks = &[_]sh.WeekOf([4]sh.Creneau){@splat(@splat(sh.Creneau.s))} },
        },
        .firstWeekRoulement = 0,
    }, .{}, &buffer.writer);
    const jsonIn = buffer.written();

    const out = try createPlanning(gpa, jsonIn.ptr, jsonIn.len);
    defer gpa.free(out);

    const exp = 
        \\{"err":"Impossible de résoudre les contraintes."}
    ;
    try std.testing.expectEqualStrings(exp, out);
}
