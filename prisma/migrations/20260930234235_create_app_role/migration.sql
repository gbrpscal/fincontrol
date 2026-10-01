-- Role de runtime da aplicação, separada da role usada para rodar
-- migrações. RLS NUNCA se aplica a superusuário (é regra do Postgres,
-- FORCE ROW LEVEL SECURITY não muda isso) — a role que roda `prisma migrate`
-- (a do POSTGRES_USER do compose, bootstrap/superuser) tem que ficar
-- reservada só pra DDL. A aplicação em si precisa conectar como uma role
-- comum, sem BYPASSRLS, ou as policies da migration anterior não valem nada
-- na prática.
--
-- Senha aqui é só de desenvolvimento (mesmo valor que APP_DATABASE_URL no
-- docker-compose.yml). Em produção, a role é criada/gerenciada do mesmo
-- jeito, mas a senha vem de um secrets manager e é setada separadamente
-- (ALTER ROLE ... WITH PASSWORD), nunca commitada.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fincontrol_app') THEN
    CREATE ROLE fincontrol_app LOGIN PASSWORD 'fincontrol_app_dev_only';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO fincontrol_app;
GRANT USAGE ON SCHEMA analytics TO fincontrol_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fincontrol_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO fincontrol_app;

-- Tabelas criadas por migrações futuras também precisam ficar acessíveis
-- pra essa role automaticamente, sem exigir um GRANT manual a cada migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fincontrol_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fincontrol_app;
