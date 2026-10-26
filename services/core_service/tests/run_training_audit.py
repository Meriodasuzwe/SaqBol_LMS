"""Offline entry point for submission regressions and scoped audit checks.

Run in the existing core-service image with /source mounted read-only,
--network none, --read-only and a writable /tmp tmpfs. No Compose services,
environment files, seed commands or persistent database volumes are used.
Only selected Python source, migrations, the listed tests and synthetic JSON
fixture are copied into an automatically removed temporary directory.
"""

import os
from pathlib import Path
import shutil
import socket
import sys
import tempfile


class OfflineSocket(socket.socket):
    def connect(self, *args, **kwargs):
        raise RuntimeError("Network connections are forbidden in training audit tests")

    def connect_ex(self, *args, **kwargs):
        raise RuntimeError("Network connections are forbidden in training audit tests")

    def sendto(self, *args, **kwargs):
        raise RuntimeError("Network traffic is forbidden in training audit tests")


def main():
    source = Path("/source")
    if sys.platform != "linux" or not source.is_dir():
        raise SystemExit("Use the documented isolated Docker command; do not run against a working environment.")

    # Do not inherit runtime configuration from the image or caller.
    os.environ.clear()
    os.environ.update({
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "LANG": "C.UTF-8",
        "DJANGO_SETTINGS_MODULE": "core.test_settings",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        "AI_ENABLED": "False",
    })
    sys.dont_write_bytecode = True
    socket.socket = OfflineSocket

    with tempfile.TemporaryDirectory(prefix="saqbol-training-audit-") as temporary:
        work = Path(temporary)
        os.environ["HOME"] = str(work)
        explicit_files = (
            "quizzes/grading.py",
            "tests/test_training_audit.py",
            "tests/test_quiz_workflows.py",
            "tests/test_builder_atomic_save.py",
            "tests/test_sql_selection_fixture.py",
            "tests/fixtures/sql_selection_training.json",
        )
        packages = ("core", "users", "courses", "quizzes", "analytics", "notifications", "bug_reports")
        for package in packages:
            files = list((source / package).glob("*.py"))
            files += list((source / package / "migrations").glob("*.py"))
            for path in files:
                if path.relative_to(source).as_posix() in explicit_files:
                    continue
                if path.is_symlink():
                    raise RuntimeError("Refusing a symlink in source allowlist")
                destination = work / path.relative_to(source)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)

        for relative in explicit_files:
            path = source / relative
            if path.is_symlink():
                raise RuntimeError("Refusing a symlink in test allowlist")
            destination = work / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)

        os.chdir(work)
        sys.path.insert(0, str(work))
        from core import test_settings

        database = test_settings.DATABASES
        if set(database) != {"default"} or database["default"] != {
            "ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:",
        }:
            raise RuntimeError("Audit requires exactly one SQLite in-memory database")
        if test_settings.AI_ENABLED:
            raise RuntimeError("AI must stay disabled")

        print("Isolation: ephemeral SQLite :memory:, network blocked, synthetic fixture only", flush=True)
        import pytest

        return pytest.main([
            "-p", "django", "-p", "no:cacheprovider", "--ds=core.test_settings",
            "--confcutdir", str(work), "-v", "-s", "--tb=short",
            "tests/test_training_audit.py", "tests/test_sql_selection_fixture.py",
            "tests/test_quiz_workflows.py",
            "tests/test_builder_atomic_save.py",
        ])


if __name__ == "__main__":
    raise SystemExit(main())
