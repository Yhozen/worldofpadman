"""Deterministic PK3s from tracked WoP assets; maps are loaded on demand."""
import json
from pathlib import Path
import sys
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED


def pack(output, entries):
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for name, path in sorted(entries):
            data = path.read_bytes()
            if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
                raise RuntimeError(f"Missing LFS asset: {path}. Run git lfs pull first.")
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)


def main(repo, output):
    wop = repo / "wop"
    output.mkdir(parents=True, exist_ok=True)
    base, maps = [], {}
    # Music/video are optional in the launcher; every gameplay asset is included.
    for source in sorted(wop.glob("*.pk3dir")):
        entries = [(p.relative_to(source).as_posix(), p) for p in source.rglob("*") if p.is_file()]
        core = [(name, p) for name, p in entries if not name.startswith("maps/")]
        if core:
            filename = f"wop_{source.stem}.pk3"
            pack(output / filename, core)
            base.append(filename)
        for bsp in sorted((source / "maps").glob("*.bsp")):
            if bsp.stem in maps:
                raise RuntimeError(f"Duplicate map: {bsp.stem}")
            filename = f"wop_map-{bsp.stem}.pk3"
            pack(output / filename, [(p.relative_to(source).as_posix(), p)
                for p in sorted(bsp.parent.glob(bsp.stem + ".*")) if p.suffix in (".bsp", ".aas")])
            maps[bsp.stem] = filename
    entries = [(p.name, p) for p in wop.glob("*.cfg")]
    for name in ("cgame", "qagame", "ui"):
        path = wop / "vm" / f"{name}.qvm"
        if not path.is_file():
            raise RuntimeError(f"Build the native qvm target first: {path}")
        entries.append((f"vm/{name}.qvm", path))
    pack(output / "wop_vm.pk3", entries)
    base.append("wop_vm.pk3")
    (output / "paks.json").write_text(json.dumps({"base": base, "maps": maps}, sort_keys=True) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
