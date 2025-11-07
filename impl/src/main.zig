const std = @import("std");
const impl = @import("root.zig");
const check = @import("check.zig");
const create = @import("create.zig");
const sh = @import("shared.zig");

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    const alloc = arena.allocator();

    _ = create.generateDayHoraires(alloc, @splat(check.ChildrenCount{}));
    // Prints to stderr, ignoring potential errors.
    std.debug.print("All your {s} are belong to us.\n", .{"codebase"});
    try impl.bufferedPrint();
}
