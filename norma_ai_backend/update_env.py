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

# Process lines and update values
updated_lines = []
modified = False
db_url_present = False
test_db_set = False

for line in lines:
    # Remove comments and whitespace
    stripped = line.strip()
    
    # Skip empty lines or comments
    if not stripped or stripped.startswith('#'):
        updated_lines.append(line)
        continue
    
    # Check for DATABASE_URL
    if stripped.startswith('DATABASE_URL='):
        db_url_present = True
        # Ensure it's not commented out
        if '#' in stripped:
            line = stripped.split('#')[0].strip() + '\n'
            modified = True
            print("Uncommented DATABASE_URL")
    
    # Check/update TEST_DB_CONNECTION
    if stripped.startswith('TEST_DB_CONNECTION='):
        test_db_set = True
        if 'false' in stripped.lower():
            line = 'TEST_DB_CONNECTION=true\n'
            modified = True
            print("Updated TEST_DB_CONNECTION to true")
    
    updated_lines.append(line)

# Add TEST_DB_CONNECTION if not present
if not test_db_set:
    updated_lines.append('TEST_DB_CONNECTION=true\n')
    modified = True
    print("Added TEST_DB_CONNECTION=true")

# Write changes back to .env
if modified:
    with open(env_file, 'w') as f:
        f.writelines(updated_lines)
    print("Updated .env file successfully")
else:
    print("No changes needed in .env file")

# Print current environment variables
print("\nCurrent environment config:")
print(f"DATABASE_URL present: {db_url_present}")
print(f"TEST_DB_CONNECTION set to true: {test_db_set or modified}")
