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

# Default PostgreSQL connection string for local development
default_db_url = "postgresql://postgres:postgres@localhost:5432/norma_ai"

# Process lines and update values
updated_lines = []
db_url_present = False

for line in lines:
    # Check for DATABASE_URL and uncomment if present but commented
    if 'DATABASE_URL' in line:
        if line.strip().startswith('#'):
            line = line.lstrip('#').lstrip()
            print("Uncommented existing DATABASE_URL")
        db_url_present = True
    
    updated_lines.append(line)

# Add DATABASE_URL if not present
if not db_url_present:
    updated_lines.append(f'DATABASE_URL="{default_db_url}"\n')
    print(f"Added DATABASE_URL={default_db_url}")

# Also ensure TEST_DB_CONNECTION is set to true
test_db_set = False
for line in updated_lines:
    if 'TEST_DB_CONNECTION' in line:
        test_db_set = True
        if 'false' in line.lower():
            # Replace the line with the correct value
            index = updated_lines.index(line)
            updated_lines[index] = 'TEST_DB_CONNECTION=true\n'
            print("Updated TEST_DB_CONNECTION to true")

if not test_db_set:
    updated_lines.append('TEST_DB_CONNECTION=true\n')
    print("Added TEST_DB_CONNECTION=true")

# Write changes back to .env
with open(env_file, 'w') as f:
    f.writelines(updated_lines)

print("Updated .env file successfully")
