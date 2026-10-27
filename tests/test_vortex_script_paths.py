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
        self.assertEqual(glow.inputs["Type"].default_value, "FOG_GLOW")
        self.assertEqual(glow.inputs["Quality"].default_value, "HIGH")
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


if __name__ == "__main__":
    unittest.main()
