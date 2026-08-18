# Local source data

`data/local/` is reserved for server-only, Git-ignored development snapshots produced from authorized bounded connector reads. Source records in that directory must never be committed.

The application disables this local snapshot adapter in production unless a separate explicit deployment override is configured. Production deployments require authenticated sessions, organization authorization, and managed connector credentials.
