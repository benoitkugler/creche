const std = @import("std");
const Allocator = std.mem.Allocator;
const sh = @import("shared.zig");
const api = @import("api.zig");

// zig build-exe src/root.zig -target wasm32-freestanding -O ReleaseFast -fno-entry --export=alloc --export=free --export=checkPlanningJSON --export=createPlanningJSON
// mv root.wasm ../public/main_zig.wasm
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

export fn alloc(len: usize) [*]u8 {
    const slice = std.heap.wasm_allocator.alloc(u8, len) catch @panic("failed to allocate memory");
    return slice.ptr;
}

export fn free(ptr: [*]u8, len: usize) void {
    std.heap.wasm_allocator.free(ptr[0..len]);
}

export fn checkPlanningJSON(jsonPtr: [*]u8, jsonLen: usize) u64 {
    const gpa = std.heap.wasm_allocator;
    const out = api.checkPlanning(gpa, jsonPtr, jsonLen) catch @panic("unexpected error in checkPlanning");
    return SlicePtr.toInt(out);
}

export fn createPlanningJSON(jsonPtr: [*]u8, jsonLen: usize) u64 {
    const gpa = std.heap.wasm_allocator;
    const out = api.createPlanning(gpa, jsonPtr, jsonLen) catch @panic("unexpected error in createPlanning");
    return SlicePtr.toInt(out);
}
