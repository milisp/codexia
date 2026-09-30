CREATE TABLE daily_counts (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, name, version, platform, arch)
);
