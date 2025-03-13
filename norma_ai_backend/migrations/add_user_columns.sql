-- Add preferred_jurisdictions column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='preferred_jurisdictions') THEN
        ALTER TABLE users ADD COLUMN preferred_jurisdictions TEXT DEFAULT '["us"]';
        RAISE NOTICE 'Added preferred_jurisdictions column';
    ELSE
        RAISE NOTICE 'preferred_jurisdictions column already exists';
    END IF;
END $$;

-- Add preferred_legal_sources column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='preferred_legal_sources') THEN
        ALTER TABLE users ADD COLUMN preferred_legal_sources TEXT DEFAULT '["official"]';
        RAISE NOTICE 'Added preferred_legal_sources column';
    ELSE
        RAISE NOTICE 'preferred_legal_sources column already exists';
    END IF;
END $$;
