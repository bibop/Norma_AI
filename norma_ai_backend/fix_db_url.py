#!/usr/bin/env python3
import os
import sys
from pathlib import Path

env_file = Path(__file__).parent / '.env'

# Check if .env file exists
if not env_file.exists():
    print("ERROR: .env file not found!")
    sys.exit(1)

# Read current .env content
with open(env_file, 'r') as f:
    lines = f.readlines()

# Standard PostgreSQL connection string for macOS
# Most macOS systems use the current username for PostgreSQL
import getpass
current_user = getpass.getuser()

# Construct a proper PostgreSQL connection URL for macOS
postgres_url = f"postgresql://{current_user}@localhost:5432/norma_ai"

# Update the DATABASE_URL line
updated_lines = []
for line in lines:
    if line.strip().startswith('DATABASE_URL='):
        line = f'DATABASE_URL="{postgres_url}"\n'
        print(f"Updated DATABASE_URL to: {postgres_url}")
    updated_lines.append(line)

# Write changes back to .env
with open(env_file, 'w') as f:
    f.writelines(updated_lines)

print("Updated .env file successfully")
