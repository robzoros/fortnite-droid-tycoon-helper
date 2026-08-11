#!/usr/bin/env python3
"""Servidor HTTP simple para servir la app Fortnite Droid Tycoon Helper en la red local."""

import os
import platform
import shutil
import socket
import subprocess
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


RULE_NAME = "FortniteDroidTycoonHelper"


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))

    def handle(self):
        try:
            super().handle()
        except OSError:
            pass


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def ensure_windows_firewall_rule(port):
    if platform.system() != "Windows":
        return

    if not shutil.which("netsh"):
        return

    check = subprocess.run(
        ["netsh", "advfirewall", "firewall", "show", "rule", f"name={RULE_NAME}"],
        capture_output=True, text=True,
    )
    if "No rules" not in check.stdout and RULE_NAME in check.stdout:
        return

    add = subprocess.run(
        ["netsh", "advfirewall", "firewall", "add", "rule",
         f"name={RULE_NAME}",
         "dir=in", "action=allow",
         "protocol=TCP", f"localport={port}"],
        capture_output=True, text=True,
    )
    if add.returncode == 0:
        print(f"[OK] Regla de firewall '{RULE_NAME}' añadida para el puerto {port}.")
    else:
        print("[AVISO] No se pudo añadir la regla de firewall automaticamente.")
        print("       Ejecuta este servidor como Administrador o añade la regla con:")
        print(f'       netsh advfirewall firewall add rule name="{RULE_NAME}" dir=in action=allow protocol=TCP localport={port}')


def main():
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])

    directory = Path(__file__).resolve().parent
    ensure_windows_firewall_rule(port)

    handler = lambda *a, **kw: CORSRequestHandler(*a, directory=str(directory), **kw)
    server = HTTPServer(("0.0.0.0", port), handler)
    ip = get_local_ip()
    print("=" * 60)
    print(" Fortnite Droid Tycoon Helper - Servidor iniciado")
    print("=" * 60)
    print(f" En este equipo:   http://localhost:{port}/")
    print(f" En la red local:  http://{ip}:{port}/")
    print("=" * 60)
    print(" Pulsa Ctrl+C para detener el servidor.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    main()