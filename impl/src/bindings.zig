const std = @import("std");
const sh = @import("shared.zig");
const check = @import("check.zig");
const api = @import("api.zig");
const Allocator = std.mem.Allocator;

fn typescriptTypeName(gpa: Allocator, comptime T: type) []const u8 {
    var w = std.Io.Writer.Allocating.init(gpa);
    switch (@typeInfo(T)) {
        .int => {
            return "int";
        },
        .float => {
            return "number";
        },
        .bool => {
            return "boolean";
        },
        .array => |array| {
            const elem = typescriptTypeName(gpa, array.child);
            var buffer = std.ArrayList(u8).initCapacity(gpa, 100) catch unreachable;
            for (0..array.len) |_| {
                buffer.appendSlice(gpa, elem) catch unreachable;
                buffer.appendSlice(gpa, ", ") catch unreachable;
            }
            w.writer.print("[{s}]", .{buffer.items}) catch unreachable;
            return w.written();
        },
        .pointer => |ptr| {
            if (ptr.size == .slice) {
                // special case for strings
                if (ptr.is_const and ptr.child == u8) {
                    return "string";
                }
                w.writer.print("{s}[]", .{typescriptTypeName(gpa, ptr.child)}) catch unreachable;
                return w.written();
            }
        },
        .optional => |opt| {
            w.writer.print("({s} | null)", .{typescriptTypeName(gpa, opt.child)}) catch unreachable;
            return w.written();
        },
        else => {
            // return "any";
            const name = @typeName(T);
            // remove prefix
            var out = std.mem.trimStart(u8, name, "shared.");
            out = std.mem.trimStart(u8, out, "check.");
            out = std.mem.trimStart(u8, out, "api.");
            // and replace . by _
            const output = gpa.dupe(u8, out) catch unreachable;
            std.mem.replaceScalar(u8, output, '.', '_');
            return output;
        },
    }
}

fn isDateField(value: std.builtin.Type.StructField) bool {
    switch (@typeInfo(value.type)) {
        .pointer => |ptr| {
            if (ptr.size == .slice and ptr.child == u8 and ptr.is_const) {
                if (value.defaultValue()) |val| {
                    if (isSliceDate(val)) {
                        // we have a Date
                        return true;
                    }
                }
            }
        },
        else => {},
    }
    return false;
}

fn isSliceDate(val: sh.string) bool {
    if (val.len != sh.defaultDateTag.len) {
        return false;
    }
    return val[0..sh.defaultDateTag.len] == sh.defaultDateTag;
}

fn generateStruct(gpa: Allocator, comptime T: type, generated: *std.StringHashMap(void), dst: *std.Io.Writer) !void {
    const info = @typeInfo(T).@"struct";
    var childBuffer = std.Io.Writer.Allocating.init(gpa);

    try dst.print("export type {s} = {{\n", .{typescriptTypeName(gpa, T)});
    inline for (info.fields) |value| {
        const childType = if (isDateField(value)) "Date" else typescriptTypeName(gpa, value.type);
        try dst.print("\t{s}: {s};\n", .{ value.name, childType });
        // recurse
        try generateType(gpa, value.type, generated, &childBuffer.writer);
    }
    try dst.print("}}\n\n", .{});

    // copy children
    try dst.writeAll(childBuffer.written());
}

fn generateEnum(gpa: Allocator, comptime T: type, dst: *std.Io.Writer) !void {
    const info = @typeInfo(T).@"enum";
    const typeName = typescriptTypeName(gpa, T);

    // Zig default behavior is using values names
    try dst.print("export type {s} = \n", .{typeName});
    inline for (info.fields) |field| {
        try dst.print("\t| '{s}'\n", .{field.name});
    }
    try dst.print("\n", .{});
}

fn generateUnion(gpa: Allocator, comptime T: type, generated: *std.StringHashMap(void), dst: *std.Io.Writer) !void {
    const info = @typeInfo(T).@"union";
    const typeName = typescriptTypeName(gpa, T);

    var childBuffer = std.Io.Writer.Allocating.init(gpa);

    try dst.print("export type {s} = \n", .{typeName});
    inline for (info.fields) |field| {
        try dst.print("\t| {{ {s} : {s} }}\n", .{ field.name, typescriptTypeName(gpa, field.type) });
        // recurse on "child"
        try generateType(gpa, field.type, generated, &childBuffer.writer);
    }
    try dst.print("\n\n", .{});

    // copy children
    try dst.writeAll(childBuffer.written());
}

fn generateType(gpa: Allocator, comptime T: type, generated: *std.StringHashMap(void), dst: *std.Io.Writer) !void {
    const name = typescriptTypeName(gpa, T);
    if (generated.get(name) != null) {
        return;
    }
    try generated.put(name, undefined);
    switch (@typeInfo(T)) {
        .int => {
            try dst.print("type int = number;\n\n", .{});
        },
        .@"enum" => {
            try generateEnum(gpa, T, dst);
        },
        .@"struct" => {
            try generateStruct(gpa, T, generated, dst);
        },
        .@"union" => {
            try generateUnion(gpa, T, generated, dst);
        },
        .array => |array| {
            try generateType(gpa, array.child, generated, dst);
        },
        .pointer => |ptr| {
            if (ptr.size == .slice) {
                try generateType(gpa, ptr.child, generated, dst);
            }
        },
        .optional => |opt| {
            try generateType(gpa, opt.child, generated, dst);
        },
        else => {},
    }
}

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    const gpa = arena.allocator();
    defer arena.deinit();

    // avoid duplications
    var generated = std.StringHashMap(void).init(gpa);

    var dst = std.Io.Writer.Allocating.init(gpa);

    try dst.writer.print("// Code generated by bindings.zig. DO NOT EDIT.\n", .{});

    try generateType(gpa, api.CheckIn, &generated, &dst.writer);
    try generateType(gpa, check.Diagnostic, &generated, &dst.writer);

    try std.fs.cwd().writeFile(.{ .sub_path = "../src/logic/types.ts", .data = dst.written() });

    std.debug.print("Done.\n", .{});
}

test "union JSON" {
    const union_ = check.Check{ .wrongAdaptationHoraire = .{ .got = sh.Range.empty() } };
    const enum_ = sh.Creneau.m;

    var out: std.io.Writer.Allocating = .init(std.testing.allocator);
    try std.json.Stringify.value(union_, .{ .whitespace = .indent_2 }, &out.writer);
    try std.json.Stringify.value(enum_, .{ .whitespace = .indent_2 }, &out.writer);
    defer out.deinit();

    std.debug.print("{s}", .{out.written()});
}
