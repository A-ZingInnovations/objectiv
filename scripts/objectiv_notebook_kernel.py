#!/usr/bin/env python3
"""Objectiv notebook kernel — JSON-lines over stdin/stdout."""

from __future__ import annotations

import ast
import base64
import io
import json
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout
from typing import Any


EXEC_COUNT = 0
USER_NS: dict[str, Any] = {"__name__": "__main__"}


def _text_chunks(s: str) -> list[str]:
    if not s:
        return []
    return [s if s.endswith("\n") else s + "\n"]


def _capture_display(value: Any, execution_count: int) -> list[dict[str, Any]]:
    outputs: list[dict[str, Any]] = []
    if value is None:
        return outputs
    try:
        import matplotlib.figure  # type: ignore

        if isinstance(value, matplotlib.figure.Figure):
            buf = io.BytesIO()
            value.savefig(buf, format="png", bbox_inches="tight")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            outputs.append(
                {
                    "output_type": "display_data",
                    "data": {"image/png": b64, "text/plain": "<Figure>"},
                    "metadata": {},
                }
            )
            return outputs
    except Exception:
        pass

    text = repr(value)
    outputs.append(
        {
            "output_type": "execute_result",
            "data": {"text/plain": text},
            "metadata": {},
            "execution_count": execution_count,
        }
    )
    return outputs


def exec_code(code: str) -> dict[str, Any]:
    global EXEC_COUNT
    EXEC_COUNT += 1
    outputs: list[dict[str, Any]] = []
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        tree = ast.parse(code, mode="exec")
        body = tree.body
        last_expr = None
        if body and isinstance(body[-1], ast.Expr):
            last_expr = body.pop()

        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            if body:
                exec(compile(ast.Module(body=body, type_ignores=[]), "<cell>", "exec"), USER_NS, USER_NS)
            if last_expr is not None:
                value = eval(
                    compile(ast.Expression(last_expr.value), "<cell>", "eval"),
                    USER_NS,
                    USER_NS,
                )
                outputs.extend(_capture_display(value, EXEC_COUNT))
    except Exception:
        etype, evalue, tb = sys.exc_info()
        outputs.append(
            {
                "output_type": "error",
                "ename": getattr(etype, "__name__", "Error"),
                "evalue": str(evalue),
                "traceback": traceback.format_exception(etype, evalue, tb),
            }
        )

    out = stdout_buf.getvalue()
    err = stderr_buf.getvalue()
    prefix: list[dict[str, Any]] = []
    if out:
        prefix.append({"output_type": "stream", "name": "stdout", "text": _text_chunks(out)})
    if err:
        prefix.append({"output_type": "stream", "name": "stderr", "text": _text_chunks(err)})
    outputs = prefix + outputs

    return {"ok": True, "outputs": outputs, "execution_count": EXEC_COUNT}


def restart() -> dict[str, Any]:
    global EXEC_COUNT, USER_NS
    EXEC_COUNT = 0
    USER_NS = {"__name__": "__main__"}
    return {"ok": True}


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            print(json.dumps({"ok": False, "error": f"bad json: {e}"}), flush=True)
            continue
        op = msg.get("op")
        if op == "exec":
            print(json.dumps(exec_code(msg.get("code") or "")), flush=True)
        elif op == "restart":
            print(json.dumps(restart()), flush=True)
        elif op == "ping":
            print(json.dumps({"ok": True, "pong": True}), flush=True)
        elif op == "shutdown":
            print(json.dumps({"ok": True}), flush=True)
            break
        else:
            print(json.dumps({"ok": False, "error": f"unknown op {op}"}), flush=True)


if __name__ == "__main__":
    main()
