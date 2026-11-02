"""Author the CORE kit, editable Blender scenes, GLB and reference renders.

blender -b -t 2 --python scripts/blender/build_core.py -- --render
No add-ons or downloaded textures. Coordinates in helpers are game X/Y/Z (Y up).
The glTF exporter performs Blender Z-up -> glTF Y-up, preserving 4 m tile pivots.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
T, H = 4.0, 2.8
THEMES = [
    ('Confinement', 'CONFINEMENT', (0.72, 0.80, 0.83), (0.15, 0.80, 0.95)),
    ('Industrie', 'INDUSTRIE', (0.34, 0.30, 0.25), (1.0, 0.35, 0.07)),
    ('Coeur energetique', 'ENERGIE', (0.38, 0.41, 0.53), (0.60, 0.22, 1.0)),
    ('Labyrinthe instable', 'ARCHIVES', (0.26, 0.37, 0.44), (0.20, 0.63, 0.82)),
    ('Arene CORE', 'ARENE', (0.39, 0.42, 0.43), (1.0, 0.60, 0.16)),
]
MODULES = {}
MATERIALS = {}
THEMED_COLLECTIONS = {}
THEMED_MATERIALS = {}
ACTIVE = None


def material(name, color, metal=0.55, rough=0.6, emission=0.0):
    m = bpy.data.materials.new('CORE_' + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emission:
        (p.inputs.get('Emission Color') or p.inputs.get('Emission')).default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    MATERIALS[name] = m
    return m


def move_to_module(obj, name, mat):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    ACTIVE.objects.link(obj)
    obj.name = name
    obj.data.materials.append(MATERIALS[mat])
    return obj


def box(name, mat, x, y, z, sx, sy, sz, bevel=0.018, yaw=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = move_to_module(bpy.context.object, name, mat)
    obj.dimensions = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = yaw
    if bevel:
        b = obj.modifiers.new('Machined edge / editable', 'BEVEL')
        b.width = min(bevel, min(sx, sy, sz) * 0.22)
        b.segments = 1
        b.affect = 'EDGES'
        n = obj.modifiers.new('Weighted manufacturing normals', 'WEIGHTED_NORMAL')
        n.keep_sharp = True
    return obj


def cylinder(name, mat, x, y, z, radius, depth, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(x, -z, y))
    return move_to_module(bpy.context.object, name, mat)


def text(name, body, mat, x, y, z, size=0.13):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body, curve.size, curve.extrude = body, size, 0.0003
    curve.resolution_u = 2
    curve.render_resolution_u = 2
    curve.align_x = 'CENTER'
    obj = bpy.data.objects.new(name, curve)
    ACTIVE.objects.link(obj)
    obj.location = (x, -z, y)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    curve.materials.append(MATERIALS[mat])
    return obj


def module(scene, name):
    global ACTIVE
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    c['pivot'] = 'cell centre at floor; game Y-up; wall face points +Z'
    c['cell_size'] = T
    MODULES[name] = ACTIVE = c
    return c


def wall_body(scene):
    module(scene, 'CORE_BODY')
    box('Structural cassette', 'SHELL', 0, H/2, 0, 3.76, H, 3.76, .035)
    box('Top machined rim', 'EDGE', 0, H+.015, 0, 3.94, .07, 3.94)
    box('Service roof', 'PANEL', 0, H+.10, 0, 3.64, .12, 3.64)
    box('Recessed top vent', 'DARK', 0, H+.17, 0, 2.96, .035, 2.96)
    for x in [-1.38, 1.38]:
        box('Cyan roof seam', 'ACCENT', x, H+.20, 0, .035, .018, 2.66, .002)
    for i in range(6):
        box('Roof heat exchanger fin', 'EDGE', -.97+i*.39, H+.21, 0, .16, .035, 1.85, .004)


def wall_face(scene, high=True, damaged=False):
    name = 'CORE_FACE_' + ('DAMAGED' if damaged else 'HIGH' if high else 'LOW')
    module(scene, name)
    box('Shadow gasket', 'DARK', 0, H/2, 1.90, 3.98, 2.62, .14, .012)
    for u in [-.90, .90]:
        box('Layered armour panel', 'PANEL', u, 1.40, 1.945, 1.71, 1.86, .075, .014)
    for x in [-1.86, 1.86]:
        box('Vertical structural stile', 'EDGE', x, 1.40, 1.958, .17, 2.78, .073, .012)
    for y in [.13, 2.63]:
        box('Continuous cross rail', 'EDGE', 0, y, 1.954, 3.98, .19, .075, .012)
    box('Recessed guidance lamp', 'ACCENT', 0, 2.46, 1.99, 3.46, .043, .018, .002)
    box('Horizontal panel joint', 'DARK', 0, .61, 1.987, 3.40, .035, .012, .002)
    box('Maintenance hatch backing', 'SHELL', -.91, 1.38, 1.984, 1.17, .72, .020, .003)
    box('Maintenance hatch lid', 'EDGE', -.91, 1.38, 1.995, 1.05, .61, .007, .001)
    box('Vent recess', 'DARK', .92, 1.36, 1.987, 1.20, .66, .018, .002)
    for i in range(5 if high else 3):
        box('Angled ventilation louvre', 'EDGE', .92, 1.12+i*(.10 if high else .20), 1.993, 1.08, .035, .012, .001)
    box('Safety label', 'WARNING', -.91, .84, 1.995, .83, .15, .008, .001)
    for i in range(3):
        box('Hazard chevron', 'DARK', -1.22+i*.25, .84, 1.999, .10, .14, .001, 0)
    if high:
        for x in [-1.69, 1.69, -.22, .22]:
            for y in [.35, 2.29]:
                box('Captive hex fastening', 'SHELL', x, y, 1.992, .056, .056, .014, .005)
        text('CORE etched identification', 'CORE', 'DARK', -.9, 1.34, 1.999, .145)
        text('Panel serial', 'C-07  //  ACCESS', 'EDGE', .9, 2.10, 1.999, .085)
    if damaged:
        for i in range(5):
            box('Scored panel surface', 'WEAR', -.30+i*.12, .96+i*.15, 1.999, .025, .25, .0005, 0)
        box('Missing armour plate / exposed steel', 'WEAR', .42, 1.94, 1.999, .31, .20, .0005, 0)


def floor(scene, high):
    module(scene, 'CORE_FLOOR_' + ('HIGH' if high else 'LOW'))
    box('Large ground slab', 'FLOOR', 0, -.05, 0, 3.96, .10, 3.96, .012)
    for x in [-1.75, 1.75]:
        box('Technical floor groove', 'DARK', x, .008, 0, .12, .012, 3.76, .002)
        box('Low guidance inset', 'ACCENT', x, .018, 0, .035, .010, .52, .001)
    for z in [-1.75, 1.75]:
        box('Slab fixing seam', 'EDGE', 0, .008, z, 3.48, .012, .035, .001)
    if high:
        box('Recessed technical grille', 'DARK', 0, .012, 0, .76, .012, 2.50, .001)
        for i in range(8):
            box('Replaceable grate crossbar', 'EDGE', 0, .022, -1.12+i*.32, .70, .008, .044, .001)
        for x in [-1.48, 1.48]:
            for z in [-1.48, 1.48]:
                box('Floor fastening', 'EDGE', x, .012, z, .06, .012, .06, .002)


def ceiling(scene):
    module(scene, 'CORE_CEILING')
    box('Ceiling cassette', 'SHELL', 0, H+.74, 0, 3.98, .13, 3.98, .01)
    box('Cross beam', 'EDGE', 0, H+.48, -1.84, 3.98, .22, .18, .012)
    box('Recessed luminaire', 'DARK', 0, H+.64, 0, 1.68, .08, .34, .015)
    box('Luminaire diffuser', 'ACCENT', 0, H+.58, 0, 1.47, .03, .21, .003)
    for x in [-1.47, 1.47]:
        box('Cable tray', 'DARK', x, H+.47, 0, .25, .17, 3.98, .01)
        for z in [-1.2, 0, 1.2]:
            box('Cable tray hanger', 'EDGE', x, H+.37, z, .31, .05, .12, .003)


def accessories(scene):
    module(scene, 'CORE_TERMINAL')
    box('Terminal bezel', 'SHELL', -.9, 1.51, 1.982, 1.31, .94, .030, .006)
    box('Inset screen', 'SCREEN', -.9, 1.61, 1.999, 1.12, .56, .001, 0)
    text('Terminal screen title', 'CORE', 'ACCENT', -.9, 1.69, 1.9997, .11)
    for i in range(4):
        box('Physical key', 'EDGE', -1.26+i*.24, 1.23, 1.999, .14, .055, .001, 0)
    module(scene, 'CORE_PIPES')
    for y in [2.06, 2.28]:
        box('Horizontal armoured conduit', 'EDGE', 0, y, 1.95, 3.68, .12, .08, .02)
        for x in [-1.1, 1.1]:
            box('Conduit clamp', 'SHELL', x, y, 1.976, .12, .18, .04, .006)
    module(scene, 'CORE_ENERGY')
    for x in [-1.56, 1.56]:
        box('Energy bus housing', 'SHELL', x, 1.42, 1.974, .15, 1.52, .04, .005)
        box('Energy bus light', 'ACCENT', x, 1.42, 1.997, .065, 1.34, .004, 0)
    module(scene, 'CORE_MACHINE')
    box('Peripheral equipment plinth', 'SHELL', 0, H+.49, 0, 2.65, .50, 2.65, .03)
    cylinder('Coolant pressure vessel', 'EDGE', 0, H+1.15, 0, .78, 1.5)
    for y in [H+.5, H+1.8]:
        cylinder('Vessel collar', 'SHELL', 0, y, 0, .91, .14)
    cylinder('Status beacon', 'ACCENT', 0, H+1.95, 0, .37, .12)
    module(scene, 'CORE_DOOR')
    box('Inset security door body', 'SHELL', 0, H/2, 0, 3.76, H, 3.76, .02)
    for z in [-1.989, 1.989]:
        box('Door panel inset', 'PANEL', 0, 1.4, z, 3.48, 2.2, .015, .002)
        for x in [-1.50, 1.50]:
            box('Door high visibility rail', 'WARNING', x, 1.4, z, .12, 2.18, .020, .003)
        box('Door split seam', 'DARK', 0, 1.4, z, .05, 2.19, .021, .001)
    box('Door phase indicator', 'SIGNAL', 0, H+.13, 0, 1.52, .08, 2.0, .003)
    module(scene, 'CORE_REACTOR')
    cylinder('Luminous containment column', 'ACCENT', 0, H+3.0, 0, .72, 5.2, 16)
    for y in [H+.6, H+2.1, H+4.0, H+5.6]:
        cylinder('Reactor containment collar', 'SHELL', 0, y, 0, 1.62, .28, 16)
        cylinder('Reactor collar inlay', 'EDGE', 0, y+.16, 0, 1.50, .04, 16)
    for x in [-1.2, 1.2]:
        for z in [-1.2, 1.2]:
            box('Containment cage', 'EDGE', x, H+3, z, .17, 5.9, .17, .015)
    box('Titan arrival indicator', 'SIGNAL', 0, H+6.15, 0, 2.50, .26, 1.0, .02)
    module(scene, 'CORE_DEPLOYMENT')
    box('Drone launch bay', 'SHELL', 0, H+.48, 0, 2.8, .52, 2.8, .03)
    for x in [-1.0, 0, 1.0]:
        box('Launch bay hatch', 'PANEL', x, H+.79, 0, .82, .08, 2.3, .015)
    box('Wave annunciator', 'SIGNAL', 0, H+.88, 0, 2.5, .08, .14, .004)
    module(scene, 'CORE_PLATFORM')
    for s in [-1, 1]:
        box('Central flush platform outline', 'WARNING', s*5.6, .028, 0, .08, .01, 10.9, .001)
        box('Central flush platform outline', 'WARNING', 0, .028, s*5.6, 10.9, .01, .08, .001)


def instance(scene, name, x, z, yaw=0, material_override=None):
    collection=MODULES[name]
    level=scene.get('core_level',0)
    if level:
        key=(level,name)
        if key not in THEMED_COLLECTIONS:
            clone=bpy.data.collections.new('%02d_%s'%(level+1,name))
            for source in collection.objects:
                obj=source.copy();clone.objects.link(obj)
                for slot in obj.material_slots:
                    semantic=slot.material.name
                    mkey=(level,semantic)
                    if mkey not in THEMED_MATERIALS:
                        m=slot.material.copy()
                        m.name='%02d_%s'%(level+1,semantic)
                        color=THEMES[level][2] if semantic=='CORE_PANEL' else THEMES[level][3] if semantic in ['CORE_ACCENT','CORE_SIGNAL'] else None
                        if color:
                            p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
                            if semantic!='CORE_PANEL':(p.inputs.get('Emission Color') or p.inputs.get('Emission')).default_value=(*color,1)
                        THEMED_MATERIALS[mkey]=m
                    slot.link='OBJECT';slot.material=THEMED_MATERIALS[mkey]
            THEMED_COLLECTIONS[key]=clone
        collection=THEMED_COLLECTIONS[key]
    o = bpy.data.objects.new(name, None)
    o.instance_type, o.instance_collection = 'COLLECTION', collection
    o.location, o.rotation_euler.z = (x, -z, 0), yaw
    scene.collection.objects.link(o)
    return o


def world(scene):
    scene.world = bpy.data.worlds.new(scene.name+' atmosphere')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.055, .085, .12, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45


def area(scene, name, loc, energy, color, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    scene.collection.objects.link(o)


def setup_render(scene, eye, target, width=1200, height=750):
    world(scene)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = width, height, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = .4
    data=bpy.data.cameras.new('CORE inspection camera')
    cam=bpy.data.objects.new('CORE inspection camera',data)
    scene.collection.objects.link(cam)
    cam.location=eye
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    data.lens=23
    scene.camera=cam
    area(scene,'Soft overhead illumination',(0,3,12),1800,(.60,.80,1),12,(0,0,0))
    area(scene,'Cool facility bounce',(-8,-4,6),1400,(.30,.65,1),10,(0,0,1))


def corridor():
    scene=bpy.data.scenes.new('CORE_REFERENCE_CORRIDOR')
    for z in range(-5,6):
        instance(scene,'CORE_FLOOR_HIGH',0,z*T)
        instance(scene,'CORE_CEILING',0,z*T)
        for x,yaw in [(-T,math.pi/2),(T,-math.pi/2)]:
            instance(scene,'CORE_BODY',x,z*T)
            instance(scene,'CORE_FACE_HIGH',x,z*T,yaw)
            if z%3==0:
                instance(scene,'CORE_TERMINAL',x,z*T,yaw)
    instance(scene,'CORE_FACE_HIGH',0,-24,0)
    setup_render(scene,(.7,-19,1.6),(0,6,1.55))
    for z in [-16,-8,0,8,16]:
        area(scene,'Ceiling diffuser',(0,-z,3.38),90,(.45,.85,1),2,(0,-z,0))
    return scene


def sector(layout, level):
    scene=bpy.data.scenes.new('CORE_SECTOR_%02d_%s'%(level+1,THEMES[level][1]))
    scene['core_level']=level
    g=layout['grid'];n=len(g);dynamic={tuple(c) for c in layout['dynamicCells']}
    solid=lambda x,z: 0<=x<n and 0<=z<n and g[z][x] and (x,z) not in dynamic and not (level==2 and x==n//2 and z==n//2)
    at=lambda i:(i-n/2+.5)*T
    for z in range(n):
        for x in range(n):
            cx,cz=at(x),at(z)
            if solid(x,z):
                instance(scene,'CORE_BODY',cx,cz)
                for dx,dz,yaw in [(0,1,0),(1,0,math.pi/2),(0,-1,math.pi),(-1,0,-math.pi/2)]:
                    if 0<=x+dx<n and 0<=z+dz<n and not solid(x+dx,z+dz):
                        instance(scene,'CORE_FACE_DAMAGED' if level==3 else 'CORE_FACE_HIGH',cx,cz,yaw)
                        if level==1: instance(scene,'CORE_PIPES',cx,cz,yaw)
                        if level==2: instance(scene,'CORE_ENERGY',cx,cz,yaw)
                if (x in [0,n-1] or z in [0,n-1]) and (x+z)%4==0:
                    instance(scene,'CORE_MACHINE',cx,cz)
            else:
                instance(scene,'CORE_FLOOR_HIGH',cx,cz)
                if (x,z) in dynamic and g[z][x]:instance(scene,'CORE_DOOR',cx,cz)
    if level==4:
        instance(scene,'CORE_REACTOR',0,at(0))
        instance(scene,'CORE_PLATFORM',0,0)
        for x,z in [(0,4),(14,4),(0,10),(14,10)]:instance(scene,'CORE_DEPLOYMENT',at(x),at(z))
    setup_render(scene,(32,-38,38),(0,3,0))
    return scene


def export_library(scene, destination):
    """Export evaluated bevels with named template roots; source scenes stay editable."""
    export_scene=bpy.data.scenes.new('CORE_EXPORT')
    bpy.context.window.scene=export_scene
    for name,collection in MODULES.items():
        root=bpy.data.objects.new(name,None)
        export_scene.collection.objects.link(root)
        for source in collection.objects:
            copy=source.copy()
            copy.data=source.data.copy()
            export_scene.collection.objects.link(copy)
            copy.parent=root
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',use_selection=False,
        use_active_scene=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,
        export_animations=False,export_texcoords=False,export_normals=True,export_materials='EXPORT')
    bpy.data.scenes.remove(export_scene)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--render-sectors',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    library=bpy.context.scene;library.name='CORE_MODULAR_LIBRARY'
    material('SHELL',(.10,.15,.19),.78,.55)
    material('PANEL',THEMES[0][2],.58,.48)
    material('EDGE',(.42,.51,.55),.78,.36)
    material('DARK',(.018,.032,.042),.3,.78)
    material('FLOOR',(.22,.28,.31),.48,.77)
    material('ACCENT',THEMES[0][3],.25,.34,2.1)
    material('SCREEN',(.025,.16,.21),.20,.28,.50)
    material('WARNING',(.86,.57,.12),.28,.62)
    material('WEAR',(.13,.16,.18),.23,.93)
    material('SIGNAL',THEMES[0][3],.15,.4,1.2)
    wall_body(library)
    wall_face(library,True);wall_face(library,False);wall_face(library,True,True)
    floor(library,True);floor(library,False);ceiling(library);accessories(library)
    asset_dir=ROOT/'assets/models/core';asset_dir.mkdir(parents=True,exist_ok=True)
    export_library(library,asset_dir/'core-kit.glb')
    reference=corridor()
    layouts=json.loads((Path(__file__).parent/'layouts.json').read_text())
    sectors=[sector(layout,i) for i,layout in enumerate(layouts)]
    bpy.context.window.scene=reference
    bpy.ops.wm.save_as_mainfile(filepath=str(asset_dir/'core-source.blend'),compress=True)
    audit={'generator':'scripts/blender/build_core.py','blender':bpy.app.version_string,'cellSize':T,'wallHeight':H,
           'modules':{name:len(c.objects) for name,c in MODULES.items()},'scenes':[reference.name]+[s.name for s in sectors]}
    (ROOT/'docs/core-blender-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    output=ROOT/'artifacts/core/blender';output.mkdir(parents=True,exist_ok=True)
    if args.render:
        reference.render.filepath=str(output/'corridor-after.png')
        bpy.context.window.scene=reference;bpy.ops.render.render(write_still=True)
    if args.render_sectors:
        for i,scene in enumerate(sectors):
            scene.render.filepath=str(output/('sector-%d.png'%(i+1)))
            bpy.context.window.scene=scene;bpy.ops.render.render(write_still=True)
    print('CORE_BLENDER_COMPLETE',json.dumps(audit))


if __name__=='__main__':
    main()
