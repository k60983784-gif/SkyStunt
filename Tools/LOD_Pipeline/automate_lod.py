#!/usr/bin/env python3
"""
LOD + asset-validation tool for SkyStunt.io web models (GLB).

Modes
  --check                      Validate every .glb under public/models: parses JSON, external textures exist,
                               a License.txt sits beside the models. Exit 1 on any problem. No files written.
  --build [--ratios 0.5,0.2]   For each source .glb (not already *_lod*.glb): weld + simplify with
                               gltf-transform (npm: @gltf-transform/cli), write <name>_lod1.glb, <name>_lod2.glb, and
                               print real triangle counts read from the output files.
  --report                     Print triangle and size table for every .glb without writing.

Requires Node tooling (npx gltf-transform) only for --build. --check and --report use the Python standard library.
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "public" / "models"
CLI = ROOT / "node_modules" / ".bin" / "gltf-transform"


def read_glb_json(path: Path):
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError("not a GLB file (missing 'glTF' magic)")
    version, _length = struct.unpack("<II", data[4:12])
    if version != 2:
        raise ValueError(f"unsupported glTF version {version}")
    chunk_len, chunk_type = struct.unpack("<II", data[12:20])
    if chunk_type != 0x4E4F534A:  # 'JSON'
        raise ValueError("first chunk is not JSON")
    return json.loads(data[20:20 + chunk_len])


def triangle_count(doc) -> int:
    accessors = doc.get("accessors", [])
    total = 0
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            mode = prim.get("mode", 4)
            if mode != 4:  # only triangle lists are counted
                continue
            if "indices" in prim:
                count = accessors[prim["indices"]]["count"]
            else:
                count = accessors[prim["attributes"]["POSITION"]]["count"]
            total += count // 3
    return total


def check_models() -> int:
    problems = []
    glbs = sorted(MODELS.rglob("*.glb")) if MODELS.exists() else []
    if not glbs:
        problems.append("no .glb files found under public/models")
    for glb in glbs:
        try:
            doc = read_glb_json(glb)
        except Exception as e:  # noqa: BLE001 - report every failure
            problems.append(f"{glb.relative_to(ROOT)}: {e}")
            continue
        for img in doc.get("images", []):
            uri = img.get("uri")
            if uri and not uri.startswith("data:") and not (glb.parent / uri).exists():
                problems.append(f"{glb.relative_to(ROOT)}: missing external texture {uri}")
        lic = glb.parent / "License.txt"
        if not lic.exists():
            problems.append(f"{glb.relative_to(ROOT)}: no License.txt in {glb.parent.relative_to(ROOT)}")
        print(f"OK   {glb.relative_to(ROOT)}  triangles={triangle_count(doc)}")
    for p in problems:
        print("FAIL " + p)
    print(f"{len(glbs)} model(s) checked, {len(problems)} problem(s)")
    return 1 if problems else 0


def report() -> int:
    for glb in sorted(MODELS.rglob("*.glb")):
        doc = read_glb_json(glb)
        print(f"{glb.relative_to(ROOT)}\ttriangles={triangle_count(doc)}\tbytes={glb.stat().st_size}")
    return 0


def run_cli(args):
    if not CLI.exists():
        sys.exit("gltf-transform not installed. Run: npm i -D @gltf-transform/cli --legacy-peer-deps")
    subprocess.run([str(CLI), *args], check=True)


def build(ratios):
    sources = [p for p in sorted(MODELS.rglob("*.glb")) if "_lod" not in p.stem]
    if not sources:
        sys.exit("no source models")
    for src in sources:
        base = src.stem
        print(f"== {src.relative_to(ROOT)} (LOD0 = source, triangles={triangle_count(read_glb_json(src))})")
        welded = src.with_name(f"{base}_welded.tmp.glb")
        run_cli(["weld", str(src), str(welded)])
        for i, ratio in enumerate(ratios, start=1):
            out = src.with_name(f"{base}_lod{i}.glb")
            run_cli(["simplify", str(welded), str(out), "--ratio", str(ratio), "--error", "0.05"])
            print(f"   LOD{i} ratio={ratio} triangles={triangle_count(read_glb_json(out))} bytes={out.stat().st_size}")
        welded.unlink(missing_ok=True)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--build", action="store_true")
    g.add_argument("--report", action="store_true")
    ap.add_argument("--ratios", default="0.5,0.2", help="comma-separated simplify ratios for --build")
    a = ap.parse_args()
    if a.check:
        return check_models()
    if a.report:
        return report()
    ratios = [float(x) for x in a.ratios.split(",") if x.strip()]
    return build(ratios)


if __name__ == "__main__":
    sys.exit(main())
