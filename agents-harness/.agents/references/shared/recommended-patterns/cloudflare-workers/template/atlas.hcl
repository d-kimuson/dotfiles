env "local" {
  src = "file://db/schema.sql"
  dev = "sqlite://dev?mode=memory"

  migration {
    dir    = "file://db/migrations"
    format = golang-migrate
  }

  # Old Workers keep running against the new schema while a deploy rolls out,
  # so reject backward-incompatible changes.
  lint {
    destructive {
      error = true
    }
    data_depend {
      error = true
    }
  }
}
