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
  --manifest                   Write public/models/library/manifest.json (pack, licence, source page, triangles, bytes)
                               for every model in public/models/library. Run after adding models.

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
LIBRARY = MODELS / "library"

# Pack metadata. Source pages were fetched in this session (see docs/ASSET_SOURCES.md).
PACKS = {
    "kenney-car-kit": {"title": "Kenney Car Kit 3.1", "source": "https://kenney.nl/assets/car-kit", "license": "CC0 1.0", "expect_license": "Creative Commons Zero"},
    "kenney-racing-kit": {"title": "Kenney Racing Kit", "source": "https://kenney.nl/assets/racing-kit", "license": "CC0 1.0", "expect_license": "Creative Commons Zero"},
    "kenney-nature-kit": {"title": "Kenney Nature Kit", "source": "https://kenney.nl/assets/nature-kit", "license": "CC0 1.0", "expect_license": "Creative Commons Zero"},
}


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


def build_manifest() -> int:
    entries = []
    for pack_dir in sorted(p for p in LIBRARY.iterdir() if p.is_dir()):
        meta = PACKS.get(pack_dir.name)
        if meta is None:
            sys.exit(f"no PACKS entry for {pack_dir.name}; add its source and licence first")
        lic_text = (pack_dir / "License.txt").read_text(encoding="utf-8", errors="replace")
        if meta["expect_license"] not in lic_text:
            sys.exit(f"{pack_dir.name}/License.txt does not contain '{meta['expect_license']}'")
        for glb in sorted(pack_dir.glob("*.glb")):
            doc = read_glb_json(glb)
            entries.append({
                "id": f"{pack_dir.name}/{glb.stem}",
                "name": glb.stem,
                "file": f"/models/library/{pack_dir.name}/{glb.name}",
                "pack": pack_dir.name,
                "packTitle": meta["title"],
                "licence": meta["license"],
                "licenceFile": f"/models/library/{pack_dir.name}/License.txt",
                "source": meta["source"],
                "triangles": triangle_count(doc),
                "bytes": glb.stat().st_size,
            })
    out = LIBRARY / "manifest.json"
    out.write_text(json.dumps({"count": len(entries), "models": entries}, indent=1), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}: {len(entries)} models")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--build", action="store_true")
    g.add_argument("--report", action="store_true")
    g.add_argument("--manifest", action="store_true")
    ap.add_argument("--ratios", default="0.5,0.2", help="comma-separated simplify ratios for --build")
    a = ap.parse_args()
    if a.check:
        return check_models()
    if a.report:
        return report()
    if a.manifest:
        return build_manifest()
    ratios = [float(x) for x in a.ratios.split(",") if x.strip()]
    return build(ratios)


if __name__ == "__main__":
    sys.exit(main())
