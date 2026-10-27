"""Author VORTEX in Blender using Python; export the editable source and game GLB.

Version 1.4 — localized nodes, Blender 5.2 menus and Text Editor context supported.

blender --background --python scripts/build_vortex.py -- --render
No external assets, Python packages, texture downloads or add-ons are required.
Blender coordinates: Z up, -Y forward. glTF exports Y up, +Z forward.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

SCRIPT_VERSION = "1.4"

def resolve_output_root(output_dir=None, source_file=None, blend_file=None):
    """Support CLI files, downloaded scripts and Blender's virtual Text paths."""
    if output_dir:
        return Path(output_dir).expanduser().resolve()

    files = [Path(value).expanduser().resolve() if value else None
             for value in (source_file, blend_file)]
    for file in files:
        if file is None or not file.is_file():
            continue
        # Iterate available ancestors: a virtual path such as \\build_vortex.py
        # has no second parent, and __file__ may be absent in the Text Editor.
        for candidate in (file.parent, *file.parent.parents):
            if (candidate / "index.html").is_file() and (candidate / "scripts").is_dir():
                return candidate

    source, blend = files
    if blend is not None and blend.is_file():
        return blend.parent
    if source is not None and source.is_file():
        return source.parent
    return Path.home() / "Documents" / "VORTEX"


def configure_compositor(scene):
    """Keep the studio glow on Blender 4.x and the node-group API in 5.x."""
    modern = hasattr(scene, "compositing_node_group")
    if modern:
        tree = bpy.data.node_groups.new("VORTEX_StudioGlow", "CompositorNodeTree")
        tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        scene.compositing_node_group = tree
    else:
        scene.use_nodes = True
        tree = scene.node_tree
    tree.nodes.clear()
    layers = tree.nodes.new("CompositorNodeRLayers")
    glow = tree.nodes.new("CompositorNodeGlare")
    # Menu sockets use item names; legacy node properties use enum identifiers.
    for socket_name, attribute, legacy_value, socket_value in [
            ("Type", "glare_type", "FOG_GLOW", "Fog Glow"),
            ("Quality", "quality", "HIGH", "High"),
            ("Threshold", "threshold", 1.8, 1.8)]:
        socket = glow.inputs.get(socket_name)
        if socket is not None:
            socket.default_value = socket_value
        else:
            setattr(glow, attribute, legacy_value)
    strength = glow.inputs.get("Strength")
    if strength is not None:
        strength.default_value = .15
    else:
        glow.mix = -.85
    out = tree.nodes.new("NodeGroupOutput" if modern else "CompositorNodeComposite")
    tree.links.new(layers.outputs["Image"], glow.inputs["Image"])
    tree.links.new(glow.outputs["Image"], out.inputs["Image"])
    return tree


ARGS = argparse.ArgumentParser(description=__doc__)
ARGS.add_argument("--render", action="store_true", help="Render the actual Blender model in the included studio")
ARGS.add_argument("--samples", type=int, default=64)
ARGS.add_argument("--output-dir", type=Path, help="Folder containing the generated assets/ directory")
args = ARGS.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
REPO = resolve_output_root(args.output_dir, globals().get("__file__"), bpy.data.filepath)
MODEL_DIR = REPO / "assets" / "models"
PREVIEW_DIR = REPO / "assets" / "previews"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
print("VORTEX_OUTPUT " + str(REPO))
print("VORTEX_BUILD " + SCRIPT_VERSION)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def socket_by_identifier(sockets, identifier):
    """Socket identifiers stay stable when display names are translated."""
    for socket in sockets:
        if socket.identifier == identifier:
            return socket
    raise RuntimeError("Missing Blender shader socket: " + identifier)


def material(name, color, metal=.75, rough=.3, emission=0):
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    # Default node names are user-editable and localized (e.g. BSDF guidée).
    # Build and link our own nodes by their stable Blender type identifiers.
    nodes = mat.node_tree.nodes
    nodes.clear()
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(shader.outputs[0], output.inputs[0])
    for identifier, value in [("Base Color", (*rgb, 1)), ("Metallic", metal),
                               ("Roughness", rough), ("Emission Color", (*rgb, 1)),
                               ("Emission Strength", emission)]:
        socket_by_identifier(shader.inputs, identifier).default_value = value
    return mat


def configure_world(world):
    world.color = (.015, .015, .015)
    world.use_nodes = True
    nodes = world.node_tree.nodes
    nodes.clear()
    background = nodes.new("ShaderNodeBackground")
    output = nodes.new("ShaderNodeOutputWorld")
    background.inputs[0].default_value = (.018, .028, .045, 1)
    background.inputs[1].default_value = .4
    world.node_tree.links.new(background.outputs[0], output.inputs[0])


BLACK = material("Vortex_Obsidian", "171E28", .82, .27)
GRAPHITE = material("Vortex_Anthracite", "354450", .78, .34)
STEEL = material("Vortex_MachinedTitanium", "7F99A5", .9, .24)
GOLD = material("Vortex_BrushedGold", "D9AF60", .78, .31)
VIOLET = material("Vortex_VioletConduits", "A846FF", .25, .3, 2.2)
CYAN = material("Vortex_CyanCeramic", "51EDFF", .2, .24, 2.4)
PLASMA = material("Vortex_CorePlasma", "C590FF", .1, .19, 4.0)
MODEL_MATERIALS = [BLACK, GRAPHITE, STEEL, GOLD, VIOLET, CYAN, PLASMA]


def empty(name, parent=None, pos=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = pos
    return obj


ROOT = empty("VORTEX_ROOT")
ROOT["authoring"] = "Blender Python / scripts/build_vortex.py"
ROOT["description"] = "CORE experimental gravity controller; seven-robot Limbyrinth roster"
ROOT["gameplay_id"] = "rvortex"


def finish(obj, name, parent, mat, pos, bevel=0, smooth=False):
    obj.name = name
    obj.parent = parent
    obj.location = pos
    obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Precision edge radii", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
        normals = obj.modifiers.new("Weighted panel normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def box(name, parent, mat, pos, size, bevel=.012, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.view_layer.objects.active
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, parent, mat, pos, min(bevel, min(size)/3), True)
    obj.rotation_euler = rotation
    return obj


def panel(name, parent, mat, outline, depth, pos=(0, 0, 0), bevel=.012):
    # Extruded, deliberately designed XZ armor profile, not stacked cubes.
    vertices = [(x, y, z) for y in (-depth/2, depth/2) for x, z in outline]
    n = len(outline)
    faces = [tuple(reversed(range(n))), tuple(range(n, n*2))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(vertices, [], faces)
    geo.update()
    bm = bmesh.new()
    bm.from_mesh(geo)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(geo)
    bm.free()
    obj = bpy.data.objects.new(name, geo)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, parent, mat, pos, bevel, True)


def cylinder(name, parent, mat, pos, radius, length, axis="Z", vertices=16, bevel=.005):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length)
    obj = finish(bpy.context.view_layer.objects.active, name, parent, mat, pos, bevel, True)
    obj.rotation_euler = {"X": (0, math.pi/2, 0), "Y": (math.pi/2, 0, 0), "Z": (0, 0, 0)}[axis]
    return obj


def torus(name, parent, mat, pos, radius, tube, axis="Y", segments=48, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=tube,
                                   major_segments=segments, minor_segments=6)
    obj = finish(bpy.context.view_layer.objects.active, name, parent, mat, pos, smooth=True)
    obj.rotation_euler = rotation if rotation else {"X": (0, math.pi/2, 0), "Y": (math.pi/2, 0, 0), "Z": (0, 0, 0)}[axis]
    return obj


def sphere(name, parent, mat, pos, radius, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius)
    return finish(bpy.context.view_layer.objects.active, name, parent, mat, pos, smooth=True)


def conduit(name, parent, mat, points, radius=.007):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 0
    curve.resolution_u = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for target, coord in zip(spline.points, points):
        target.co = (*coord, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def bolt(name, parent, pos, axis="Y"):
    return cylinder(name, parent, GOLD, pos, .016, .014, axis, 8, 0)


# Floating central chassis: three offset armor masses around an open reactor.
panel("Hull_dorsal_keel", ROOT, BLACK, [(-.43, 1.57), (-.20, 2.02), (.02, 1.87), (.16, 1.59)], .22, (0, .10, 0), .018)
panel("Hull_port_cheek", ROOT, BLACK, [(-.49, 1.57), (-.70, 1.17), (-.31, .91), (-.31, 1.12)], .24, (0, .035, 0), .018)
panel("Hull_starboard_cheek", ROOT, BLACK, [(.32, 1.64), (.65, 1.37), (.49, .84), (.19, .99)], .29, (0, .10, 0), .018)
panel("Keel_secondary_inlay", ROOT, GRAPHITE, [(-.34, 1.60), (-.19, 1.91), (-.06, 1.80), (.05, 1.61)], .035, (0, -.034, 0), .009)
panel("Port_cheek_inlay", ROOT, GRAPHITE, [(-.50, 1.46), (-.60, 1.19), (-.35, 1.02), (-.38, 1.18)], .028, (0, -.108, 0), .008)
panel("Starboard_cheek_inlay", ROOT, GRAPHITE, [(.40, 1.53), (.55, 1.34), (.44, .98), (.29, 1.07)], .035, (0, -.061, 0), .008)
conduit("Dorsal_gold_reveal", ROOT, GOLD, [(-.39, -.022, 1.59), (-.20, -.022, 1.98), (-.02, -.022, 1.85)], .009)
conduit("Port_gold_reveal", ROOT, GOLD, [(-.64, -.095, 1.19), (-.34, -.095, .98)], .009)
conduit("Starboard_gold_reveal", ROOT, GOLD, [(.60, -.062, 1.36), (.47, -.062, .92)], .009)
conduit("Etched_circuit_A", ROOT, CYAN, [(-.27, -.061, 1.67), (-.23, -.061, 1.78), (-.17, -.061, 1.78)], .005)
conduit("Etched_circuit_B", ROOT, VIOLET, [(.40, -.085, 1.09), (.44, -.085, 1.20), (.49, -.085, 1.20)], .005)
for i in range(3):
    box("Rear_heat_sink_%d" % i, ROOT, GRAPHITE, (0, .25+i*.045, 1.29), (.48, .025, .47-i*.035), .006)
for name, pos in [("Keel", (-.19, -.044, 1.88)), ("Port", (-.54, -.121, 1.19)), ("Starboard", (.47, -.084, 1.32))]:
    bolt("Hull_fastener_"+name, ROOT, pos)

# Turbine underbody, still floating well clear of the floor. No legs or feet.
cylinder("Underbody_turbine", ROOT, GRAPHITE, (0, .075, .86), .19, .20, vertices=12)
cylinder("Underbody_plasma_aperture", ROOT, VIOLET, (0, .075, .745), .115, .03, vertices=12, bevel=0)
torus("Underbody_gold_lip", ROOT, GOLD, (0, .075, .77), .15, .012, "Z", 24)

# Machined reactor frame. The glowing ring and nested gimbal have real pivots.
torus("Reactor_armored_casing", ROOT, GRAPHITE, (0, .015, 1.32), .433, .068)
torus("Reactor_front_bezel", ROOT, BLACK, (0, -.080, 1.32), .433, .037)
torus("Reactor_inner_gold_liner", ROOT, GOLD, (0, -.105, 1.32), .377, .012, segments=48)
for i in range(3):
    angle = math.radians(90+i*120)
    x, z = math.cos(angle)*.433, 1.32+math.sin(angle)*.433
    clamp = box("Reactor_lock_%d" % i, ROOT, STEEL, (x, -.13, z), (.11, .06, .08), .008)
    clamp.rotation_euler.y = -angle
    bolt("Reactor_lock_bolt_%d" % i, ROOT, (x, -.17, z))

CORE = empty("VORTEX_Core", ROOT, (0, -.035, 1.32))
sphere("Core_confined_plasma", CORE, PLASMA, (0, 0, 0), .303, 32, 16)
for i in range(3):
    a = i*math.pi*2/3
    arc = torus("Core_flux_band_%d" % i, CORE, VIOLET, (0, 0, 0), .309, .009, segments=28,
                rotation=(math.pi/2, a, .4))

RING_A = empty("VORTEX_Ring_0", ROOT, (0, -.13, 1.32))
torus("Ring_A_cyan_ceramic", RING_A, CYAN, (0, 0, 0), .466, .017, segments=64)
for i in range(3):
    angle = i*2*math.pi/3+.3
    cylinder("Ring_A_index_%d" % i, RING_A, GOLD,
             (math.cos(angle)*.466, -.013, math.sin(angle)*.466), .026, .02, "Y", 10, 0)
RING_B = empty("VORTEX_Ring_1", ROOT, (0, -.035, 1.32))
RING_B.rotation_euler = (0, .44, .25)
torus("Ring_B_gimbal", RING_B, STEEL, (0, 0, 0), .355, .018, segments=48)
torus("Ring_B_light", RING_B, CYAN, (0, -.014, 0), .356, .008, segments=48)


def arm(index, pos, angle, size=(1, 1, 1)):
    group = empty("VORTEX_Arm_%d" % index, ROOT, pos)
    group.rotation_euler.z = math.radians(angle)
    group.scale = size
    group["function"] = ["Field stabilizer", "Mass injector", "Singularity focuser"][index]
    group["deployment"] = "Radial expansion from reactor; independently animated at runtime"
    cylinder("Arm%d_bearing" % index, group, GRAPHITE, (0, 0, 0), .13, .22, "X", 16, .008)
    torus("Arm%d_gold_bearing_rim" % index, group, GOLD, (-.10, 0, 0), .111, .013, "X", 24)
    sphere("Arm%d_coupling" % index, group, VIOLET, (-.13, 0, 0), .073, 12, 8)
    panel("Arm%d_tapered_carapace" % index, group, BLACK,
          [(-.11, .02), (.03, .17), (.26, .12), (.38, -.01), (.21, -.14), (-.11, -.09)], .25, bevel=.017)
    panel("Arm%d_top_plate" % index, group, GRAPHITE,
          [(-.04, .04), (.045, .115), (.23, .075), (.29, .015), (.18, -.065)], .034, (0, -.138, 0), .007)
    conduit("Arm%d_panel_gold_seam" % index, group, GOLD,
            [(-.07, -.12, .04), (.035, -.12, .15), (.255, -.12, .10)], .008)
    for side in [-1, 1]:
        cylinder("Arm%d_linear_actuator_%d" % (index, side), group, STEEL,
                 (.21, side*.112, -.03), .024, .29, "X", 10, 0)
        conduit("Arm%d_focuser_claw_%d" % (index, side), group, GRAPHITE,
                [(.29, side*.11, -.02), (.47, side*.13, .005), (.51, side*.055, .03)], .027)
        conduit("Arm%d_gold_claw_tip_%d" % (index, side), group, GOLD,
                [(.47, side*.13, .005), (.51, side*.055, .03)], .013)
    cylinder("Arm%d_aperture_housing" % index, group, BLACK, (.32, 0, -.025), .076, .19, "X", 12, .006)
    cylinder("Arm%d_violet_aperture" % index, group, VIOLET, (.422, 0, -.025), .050, .012, "X", 12, 0)
    torus("Arm%d_aperture_cyan_rim" % index, group, CYAN, (.429, 0, -.025), .063, .009, "X", 24)
    for j in range(3):
        box("Arm%d_recessed_vent_%d" % (index, j), group, BLACK,
            (.065+j*.049, -.160, .027-j*.014), (.022, .008, .052), .002,
            (0, -.30, 0))
    bolt("Arm%d_serial_fastener" % index, group, (.021, -.166, .055))
    conduit("Arm%d_power_bus" % index, group, CYAN,
            [(-.085, .08, .075), (.055, .10, .13), (.17, .10, .10)], .005)
    return group


ARM_0 = arm(0, (.055, .67, 1.58), 94, (.95, 1, 1.08))
ARM_1 = arm(1, (-.65, -.28, 1.12), 207, (1.06, 1.02, .91))
ARM_2 = arm(2, (.66, -.31, 1.37), -29, (1.05, .91, 1))
panel("Stabilizer_asymmetric_fin", ARM_0, BLACK, [(-.08, .11), (.04, .41), (.18, .33), (.25, .11)], .12, (0, .015, 0), .012)
conduit("Stabilizer_fin_gold_edge", ARM_0, GOLD, [(-.055, -.052, .13), (.045, -.052, .38), (.16, -.052, .31)], .008)
panel("Injector_lower_guard", ARM_1, GRAPHITE, [(-.04, -.10), (.30, -.13), (.20, -.25), (.04, -.21)], .20, bevel=.010)
box("Focuser_side_cartridge", ARM_2, GRAPHITE, (.15, .16, -.03), (.22, .09, .12), .014)
box("Focuser_cartridge_glyph", ARM_2, GOLD, (.15, .211, -.025), (.083, .009, .022), .002)

# Export the real model only. The studio is created afterwards, never in the GLB.
bpy.context.view_layer.update()
model_objects = [ROOT, *ROOT.children_recursive]
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in model_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = ROOT
glb_path = MODEL_DIR / "vortex.glb"
bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_animations=False,
                          export_cameras=False, export_lights=False, export_extras=True,
                          export_materials="EXPORT", export_texcoords=False,
                          export_normals=True, export_tangents=False)

# Audit the actual exported GLB, so budgets describe what the browser will load.
data = glb_path.read_bytes()
json_length = int.from_bytes(data[12:16], "little")
gltf = json.loads(data[20:20+json_length])
triangles = sum(gltf["accessors"][p["indices"]]["count"] // 3
                for m in gltf["meshes"] for p in m["primitives"])
assert triangles <= 14000, f"Triangle budget exceeded: {triangles}"
assert not gltf.get("images") and not gltf.get("cameras")
assert len(gltf["materials"]) <= 8
manifest = {"authoring": "Blender Python", "generator": "scripts/build_vortex.py",
            "blender": bpy.app.version_string, "root": "VORTEX_ROOT", "triangles": triangles,
            "meshes": len(gltf["meshes"]), "materials": len(gltf["materials"]),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "front": "+Z (glTF)", "up": "+Y (glTF)", "external_resources": 0,
            "animation_pivots": ["VORTEX_Arm_0", "VORTEX_Arm_1", "VORTEX_Arm_2", "VORTEX_Core", "VORTEX_Ring_0", "VORTEX_Ring_1"]}
(MODEL_DIR / "vortex.audit.json").write_text(json.dumps(manifest, indent=2)+"\n")


def track(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, pos, color, power, size):
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.energy = power
    lamp.color = color
    lamp.shape = "DISK"
    lamp.size = size
    obj = bpy.data.objects.new(name, lamp)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    track(obj, (0, 0, 1.3))


# Editable source includes a studio for repeatable presentation; export above is clean.
scene = bpy.context.scene
if scene.world is None:
    scene.world = bpy.data.worlds.new("VORTEX_StudioWorld")
configure_world(scene.world)
ground = material("Studio_floor_not_exported", "0C1823", .3, .42)
cylinder("Studio_plinth_not_exported", None, ground, (0, 0, -.075), 1.7, .12, vertices=96, bevel=.025)
torus("Studio_cyan_inlay_not_exported", None, CYAN, (0, 0, -.008), 1.54, .005, "Z", 96)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.14))
floor = bpy.context.view_layer.objects.active
floor.name = "Studio_floor_not_exported"
floor.data.materials.append(ground)
area("Studio_key_not_exported", (2, -4, 5), (.85, .94, 1), 700, 4)
area("Studio_cyan_fill_not_exported", (-3, -1, 2), (.18, .7, 1), 450, 3)
area("Studio_violet_rim_not_exported", (2, 3, 4), (.6, .3, 1), 1000, 3)
area("Studio_gold_edge_not_exported", (-1, 1, 3.5), (1, .73, .4), 450, 2)
bpy.ops.object.camera_add(location=(3.6, -6.5, 3.4))
camera = bpy.context.view_layer.objects.active
camera.name = "Studio_camera_not_exported"
track(camera, (0, .05, 1.10))
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.6
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = max(1, args.samples)
# The stock headless Blender package may be built without OpenImageDenoise.
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 4
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x = 1280
scene.render.resolution_y = 1280
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW_DIR / "vortex.png")
scene.view_settings.view_transform = "AgX"
configure_compositor(scene)
for obj in bpy.context.selected_objects:
    obj.select_set(False)
ROOT.select_set(True)
bpy.context.view_layer.objects.active = ROOT
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(MODEL_DIR / "vortex.blend"), compress=True)
if args.render:
    bpy.ops.render.render(write_still=True)
print("VORTEX_EXPORT " + json.dumps(manifest))
