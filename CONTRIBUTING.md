# Contributing

## Branch naming

Create branches off `main` using the following prefixes:

- `feat/<short-description>` — new features or additions
- `fix/<short-description>` — bug fixes

Examples: `feat/resume-upload`, `fix/auth-token-refresh`

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

Examples:
- `feat: add resume parsing endpoint`
- `fix: correct job match score calculation`
- `docs: update setup instructions`

## Workflow

1. Branch off `main` using the naming convention above
2. Commit changes following the commit style above
3. Push the branch and open a pull request against `main`
4. Once approved, merge the pull request and delete the branch
