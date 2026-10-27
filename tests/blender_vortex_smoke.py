"""Run inside a real Blender executable, including an editor-like context."""
import ast
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

import bpy


class TextContext:
    def __init__(self, context):
        self._context = context

    def __getattr__(self, name):
        if name == "object":
            raise AttributeError("Text Editor context has no object member")
        return getattr(self._context, name)


class BlenderAPI:
    def __init__(self):
        self.context = TextContext(bpy.context)

    def __getattr__(self, name):
        return getattr(bpy, name)


source = Path(__file__).resolve().parents[1] / "scripts" / "build_vortex.py"
tree = ast.parse(source.read_text(encoding="utf-8"))
# The builder sees the same Blender API, but context.object is intentionally
# absent, as in the user's Text Editor. All mesh operators remain native.
tree.body = [node for node in tree.body if not (
    isinstance(node, ast.Import) and len(node.names) == 1 and node.names[0].name == "bpy")]
profile = Path(tempfile.mkdtemp(prefix="vortex-blender-editor-"))
bpy.context.preferences.view.language = "fr_FR"
bpy.context.preferences.view.use_translate_new_dataname = True
sys.argv = ["blender"]
namespace = {"__name__": "__main__", "bpy": BlenderAPI()}
with patch.object(Path, "home", return_value=profile):
    exec(compile(tree, "\\VORTEX_1_4.py", "exec"), namespace)
assert namespace["SCRIPT_VERSION"] == "1.4"
folder = profile / "Documents" / "VORTEX" / "assets" / "models"
assert (folder / "vortex.glb").is_file()
assert (folder / "vortex.blend").is_file()
audit = json.loads((folder / "vortex.audit.json").read_text(encoding="utf-8"))
assert audit["triangles"] <= 14000
print("VORTEX_NATIVE_SMOKE_OK", bpy.app.version_string)
