"""Genera hashes bcrypt para usuarios seed (ejecutar: python scripts/gen_hashes.py)."""
import bcrypt

for password in ("admin123", "cashier123"):
    h = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    print(password, h.decode())
