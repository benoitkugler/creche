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

pub fn createPlanning(gpa: Allocator, jsonPtr: [*]u8, jsonLen: usize) ![]u8 {
    const parsed: std.json.Parsed(CreateIn) = try std.json.parseFromSlice(CreateIn, gpa, jsonPtr[0..jsonLen], .{});
    defer parsed.deinit();
    const input = parsed.value;

    const out = try create.createPlanning(gpa, input.children, input.roulements, input.firstWeekRoulement);
    defer gpa.free(out.weeks);

    // build json output string
    var buffer = std.Io.Writer.Allocating.init(gpa);
    defer buffer.deinit();
    try std.json.Stringify.value(out, .{}, &buffer.writer);

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
