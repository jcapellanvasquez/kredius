DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kredius') THEN
    CREATE ROLE kredius WITH LOGIN PASSWORD 'kredius';
    RAISE NOTICE 'Role kredius created';
  ELSE
    RAISE NOTICE 'Role kredius already exists';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE kredius TO kredius;

SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'kredius';
SELECT datname, datdba::regrole FROM pg_database WHERE datname = 'kredius';
