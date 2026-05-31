"""
Build the Earthling Aidtech brand mark as a real 3D model and export to glTF.

The logo is three nested isometric cubes. We model it as:
  - outer cube  -> wireframe "frame" (12 beveled bars), cool slate
  - middle cube -> wireframe "frame", brighter blue-slate
  - inner cube  -> solid, emissive brand-blue core

Run headless:
  blender --background --python scripts/build-cube.py

Output: public/models/eat-cube.glb
"""

import bpy
import os
import math

# ---------------------------------------------------------------- reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_linear(c):
    """glTF/Blender work in linear; brand hexes are sRGB."""
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), a)


def make_material(name, base_hex, *, metallic=0.8, roughness=0.35,
                  emit_hex=None, emit_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hexcol(base_hex)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emit_hex:
        bsdf.inputs["Emission Color"].default_value = hexcol(emit_hex)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def add_cube(name, size, material, *, wireframe=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=size)
    obj = bpy.context.active_object
    obj.name = name
    if bevel > 0:
        bm = obj.modifiers.new("bevel", "BEVEL")
        bm.width = bevel
        bm.segments = 3
    if wireframe is not None:
        wm = obj.modifiers.new("wire", "WIREFRAME")
        wm.thickness = wireframe
        wm.use_even_offset = True
        wm.use_relative_offset = False
    obj.data.materials.append(material)
    # smooth-ish shading on bevels
    for p in obj.data.polygons:
        p.use_smooth = False
    return obj


# ---------------------------------------------------------------- materials
mat_outer = make_material("outer", "#5E6B7A", metallic=0.85, roughness=0.30,
                          emit_hex="#5E6B7A", emit_strength=0.25)
mat_mid = make_material("middle", "#7FBEFF", metallic=0.85, roughness=0.25,
                        emit_hex="#4A9EFF", emit_strength=0.55)
mat_core = make_material("core", "#4A9EFF", metallic=0.55, roughness=0.18,
                         emit_hex="#4A9EFF", emit_strength=2.2)

# ---------------------------------------------------------------- geometry
add_cube("CubeOuter", 2.30, mat_outer, wireframe=0.055, bevel=0.004)
add_cube("CubeMiddle", 1.42, mat_mid, wireframe=0.050, bevel=0.004)
add_cube("CubeCore", 0.64, mat_core, bevel=0.04)

# group under one empty so the whole mark transforms as a unit
bpy.ops.object.empty_add(type="PLAIN_AXES")
root = bpy.context.active_object
root.name = "EatCube"
for o in bpy.data.objects:
    if o.name.startswith("Cube"):
        o.parent = root

# slight signature tilt baked in
root.rotation_euler = (math.radians(-20), math.radians(28), 0)

# ---------------------------------------------------------------- export
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "models")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "eat-cube.glb")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_apply=True,          # apply modifiers (wireframe/bevel) into mesh
    export_yup=True,
    use_selection=True,
)
print(f"[build-cube] exported -> {out_path}")
