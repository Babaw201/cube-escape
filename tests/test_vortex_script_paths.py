"""Exercise the author's output-path resolution without importing Blender."""
import ast
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "build_vortex.py"


def load_function(name, extra=None):
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                    and node.name == name)
    namespace = {"Path": Path}
    namespace.update(extra or {})
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(SOURCE), "exec"), namespace)
    return namespace[name]


class VortexScriptPathTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.resolve = load_function("resolve_output_root")

    def test_virtual_root_script_from_blender_text_editor(self):
        virtual_file = str(Path(self.root.anchor) / "__vortex_virtual_script__.py")
        with patch.object(Path, "home", return_value=self.root / "profile"):
            self.assertEqual(self.resolve(None, virtual_file, ""),
                             self.root / "profile" / "Documents" / "VORTEX")

    def test_editor_without_file_uses_saved_blend_directory(self):
        blend = self.root / "scene.blend"
        blend.touch()
        self.assertEqual(self.resolve(None, None, str(blend)), self.root)

    def test_repository_script_keeps_existing_repository_output(self):
        (self.root / "scripts").mkdir()
        (self.root / "index.html").touch()
        script = self.root / "scripts" / "build_vortex.py"
        script.touch()
        self.assertEqual(self.resolve(None, str(script), ""), self.root)

    def test_downloaded_standalone_script_uses_its_own_folder(self):
        script = self.root / "build_vortex.py"
        script.touch()
        self.assertEqual(self.resolve(None, str(script), ""), self.root)

    def test_blend_inside_repository_does_not_nest_assets_folders(self):
        (self.root / "scripts").mkdir()
        (self.root / "index.html").touch()
        folder = self.root / "assets" / "models"
        folder.mkdir(parents=True)
        blend = folder / "vortex.blend"
        blend.touch()
        self.assertEqual(self.resolve(None, None, str(blend)), self.root)

    def test_explicit_output_directory_takes_precedence(self):
        output = self.root / "chosen"
        self.assertEqual(self.resolve(output, "/build_vortex.py", ""), output)


class MenuSocket:
    def __init__(self, allowed):
        self.allowed = allowed
        self._value = None

    @property
    def default_value(self):
        return self._value

    @default_value.setter
    def default_value(self, value):
        if value not in self.allowed:
            raise TypeError("enum %r not found in %r" % (value, self.allowed))
        self._value = value


class FakeNodes:
    def __init__(self, modern):
        self.modern = modern
        self.created = {}

    def clear(self):
        self.created.clear()

    def new(self, kind):
        node = SimpleNamespace(inputs={"Image": object()}, outputs={"Image": object()})
        if kind == "CompositorNodeGlare":
            if self.modern:
                for name in ["Type", "Quality", "Threshold", "Strength"]:
                    node.inputs[name] = SimpleNamespace(default_value=None)
                node.inputs["Type"] = MenuSocket(("Bloom", "Ghosts", "Streaks", "Fog Glow", "Simple Star", "Sun Beams", "Kernel"))
                node.inputs["Quality"] = MenuSocket(("High", "Medium", "Low"))
            else:
                node.glare_type = "STREAKS"
                node.quality = "MEDIUM"
                node.threshold = 1.0
                node.mix = 0.0
        self.created[kind] = node
        return node


class FakeTree:
    def __init__(self, modern):
        self.nodes = FakeNodes(modern)
        self.sockets = []
        self.connections = []
        self.interface = SimpleNamespace(new_socket=lambda **kw: self.sockets.append(kw))
        self.links = SimpleNamespace(new=lambda a, b: self.connections.append((a, b)))


class VortexCompositorTests(unittest.TestCase):
    def test_blender_52_group_output_and_glare_input_sockets(self):
        tree = FakeTree(modern=True)
        bpy = SimpleNamespace(data=SimpleNamespace(node_groups=SimpleNamespace(new=lambda *args: tree)))
        configure = load_function("configure_compositor", {"bpy": bpy})
        scene = SimpleNamespace(compositing_node_group=None)
        configure(scene)
        self.assertIs(scene.compositing_node_group, tree)
        self.assertEqual(tree.sockets, [{"name": "Image", "in_out": "OUTPUT", "socket_type": "NodeSocketColor"}])
        self.assertIn("NodeGroupOutput", tree.nodes.created)
        self.assertNotIn("CompositorNodeComposite", tree.nodes.created)
        glow = tree.nodes.created["CompositorNodeGlare"]
        self.assertEqual(glow.inputs["Type"].default_value, "Fog Glow")
        self.assertEqual(glow.inputs["Quality"].default_value, "High")
        self.assertEqual(glow.inputs["Threshold"].default_value, 1.8)
        self.assertEqual(glow.inputs["Strength"].default_value, .15)
        self.assertEqual(len(tree.connections), 2)

    def test_blender_43_preserves_legacy_compositor_and_glow(self):
        tree = FakeTree(modern=False)
        configure = load_function("configure_compositor")
        scene = SimpleNamespace(use_nodes=False, node_tree=tree)
        configure(scene)
        self.assertTrue(scene.use_nodes)
        self.assertIn("CompositorNodeComposite", tree.nodes.created)
        glow = tree.nodes.created["CompositorNodeGlare"]
        self.assertEqual((glow.glare_type, glow.quality, glow.threshold, glow.mix),
                         ("FOG_GLOW", "HIGH", 1.8, -.85))
        self.assertEqual(len(tree.connections), 2)


class ShaderSockets(list):
    def get(self, name):
        return next((s for s in self if s.name == name), None)

    def __getitem__(self, key):
        if isinstance(key, str):
            found = self.get(key)
            if found is None:
                raise KeyError(key)
            return found
        return super().__getitem__(key)


class ShaderNodes(list):
    def get(self, name):
        return next((n for n in self if n.name == name), None)

    def new(self, kind):
        identifiers = {
            "ShaderNodeBsdfPrincipled": ["Base Color", "Metallic", "Roughness", "Emission Color", "Emission Strength"],
            "ShaderNodeOutputMaterial": ["Surface"],
            "ShaderNodeBackground": ["Color", "Strength"],
            "ShaderNodeOutputWorld": ["Surface"],
        }[kind]
        node = SimpleNamespace(bl_idname=kind, name="Nœud traduit " + kind,
                               inputs=ShaderSockets(SimpleNamespace(identifier=s, name="Traduit " + s, default_value=None) for s in identifiers),
                               outputs=ShaderSockets([SimpleNamespace(identifier="Shader", name="Sortie", default_value=None)]))
        self.append(node)
        return node


class VortexMaterialTests(unittest.TestCase):
    def make_material(self, with_translated_default):
        nodes = ShaderNodes()
        if with_translated_default:
            nodes.new("ShaderNodeBsdfPrincipled")
            nodes.new("ShaderNodeOutputMaterial")
        links = []
        mat = SimpleNamespace(use_nodes=False, node_tree=SimpleNamespace(nodes=nodes,
                              links=SimpleNamespace(new=lambda a, b: links.append((a, b)))))
        bpy = SimpleNamespace(data=SimpleNamespace(materials=SimpleNamespace(new=lambda name: mat)))
        namespace = {"bpy": bpy, "linear": load_function("linear")}
        try:
            namespace["socket_by_identifier"] = load_function("socket_by_identifier")
        except StopIteration:
            pass  # The old function still reproduces its original NoneType error.
        material = load_function("material", namespace)
        result = material("Test", "8040FF", metal=.7, rough=.32, emission=3)
        self.assertIs(result, mat)
        shaders = [n for n in nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"]
        self.assertEqual(len(shaders), 1)
        self.assertEqual(len(links), 1)
        inputs = {s.identifier: s.default_value for s in shaders[0].inputs}
        self.assertEqual(inputs["Metallic"], .7)
        self.assertEqual(inputs["Roughness"], .32)
        self.assertEqual(inputs["Emission Strength"], 3)
        self.assertEqual(inputs["Emission Color"], inputs["Base Color"])
        self.assertEqual(inputs["Base Color"][3], 1)

    def test_translated_shader_node_and_socket_names(self):
        self.make_material(with_translated_default=True)

    def test_material_without_any_automatic_shader_nodes(self):
        self.make_material(with_translated_default=False)

    def test_translated_world_background_is_rebuilt_and_connected(self):
        configure = load_function("configure_world")
        nodes = ShaderNodes()
        nodes.new("ShaderNodeBackground")
        links = []
        world = SimpleNamespace(use_nodes=False, node_tree=SimpleNamespace(nodes=nodes,
                                links=SimpleNamespace(new=lambda a, b: links.append((a, b)))))
        configure(world)
        self.assertTrue(world.use_nodes)
        backgrounds = [n for n in nodes if n.bl_idname == "ShaderNodeBackground"]
        self.assertEqual(len(backgrounds), 1)
        self.assertEqual(backgrounds[0].inputs[0].default_value, (.018, .028, .045, 1))
        self.assertEqual(backgrounds[0].inputs[1].default_value, .4)
        self.assertEqual(len(links), 1)


class VortexTextContextTests(unittest.TestCase):
    def test_primitive_helpers_work_without_context_object(self):
        objects = SimpleNamespace(active=None)
        context = SimpleNamespace(view_layer=SimpleNamespace(objects=objects))
        def add(**kwargs):
            objects.active = SimpleNamespace()
        mesh = SimpleNamespace(**{name: add for name in ["primitive_cube_add", "primitive_cylinder_add", "primitive_torus_add", "primitive_uv_sphere_add"]})
        bpy = SimpleNamespace(context=context, ops=SimpleNamespace(mesh=mesh, object=SimpleNamespace(transform_apply=lambda **kw: None)))
        for name, positional in [("box", ((1, 1, 1),)), ("cylinder", (.1, .2)), ("torus", (.3, .02)), ("sphere", (.2,))]:
            with self.subTest(primitive=name):
                create = load_function(name, {"bpy": bpy, "math": __import__('math'), "finish": lambda obj, *args, **kwargs: obj})
                result = create("Test", None, None, (0, 0, 0), *positional)
                self.assertIs(result, objects.active)


if __name__ == "__main__":
    unittest.main()
