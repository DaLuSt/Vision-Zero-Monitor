import json
import shutil

import pytest

from scripts.release.prepare import ReleaseError, current_version, main, next_version

ROOT_FILES = ("CITATION.cff", "package.json", "package-lock.json")


@pytest.fixture
def repo(tmp_path):
    from scripts.release.prepare import ROOT
    for name in ROOT_FILES:
        shutil.copy(ROOT / name, tmp_path / name)
    return tmp_path


@pytest.mark.parametrize("bump, expected", [("patch", "1.2.4"), ("minor", "1.3.0"), ("major", "2.0.0")])
def test_next_version(bump, expected):
    assert next_version("1.2.3", bump) == expected


def test_bump_updates_all_files(repo, capsys):
    before = current_version(repo)
    assert main(["--bump", "minor", "--date", "2027-03-01"], root=repo) == 0
    major, minor, _ = map(int, before.split("."))
    new = f"{major}.{minor + 1}.0"
    assert capsys.readouterr().out.strip() == f"version={new}"
    cff = (repo / "CITATION.cff").read_text()
    assert f"\nversion: {new}\n" in cff and '\ndate-released: "2027-03-01"\n' in cff
    assert "doi: 10.5281/zenodo.23437733" in cff  # untouched
    assert json.loads((repo / "package.json").read_text())["version"] == new
    lock = json.loads((repo / "package-lock.json").read_text())
    assert lock["version"] == new and lock["packages"][""]["version"] == new


def test_exact_version_must_be_newer(repo):
    assert main(["--version", "0.9.0"], root=repo) == 1
    assert main(["--version", "v9"], root=repo) == 1
    assert main(["--version", "9.0.0", "--date", "2027-01-01"], root=repo) == 0


def test_disagreeing_files_are_refused(repo):
    pkg = json.loads((repo / "package.json").read_text())
    pkg["version"] = "7.7.7"
    (repo / "package.json").write_text(json.dumps(pkg))
    with pytest.raises(ReleaseError, match="disagree"):
        current_version(repo)
    assert main(["--bump", "patch"], root=repo) == 1


def test_bad_date_is_refused(repo):
    assert main(["--bump", "patch", "--date", "17-10-2026"], root=repo) == 1
