-- migrate:up
CREATE TABLE IF NOT EXISTS test_entries (
    id   SERIAL      PRIMARY KEY,
    name TEXT        NOT NULL,
    note TEXT        NOT NULL DEFAULT ''
);

INSERT INTO test_entries (name, note) VALUES
    ('seed-entry', 'Inserted by initial migration to verify end-to-end database connectivity');

-- migrate:down
DROP TABLE IF EXISTS test_entries;
