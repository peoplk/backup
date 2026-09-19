#!/usr/bin/env bash
# 用 git plumbing 将 nova-android-redesign 重放为无产物目录的干净副本分支，
# 不改动原分支与工作区。
set -euo pipefail

SRC_BRANCH="${1:-nova-android-redesign}"
OUT_BRANCH="${2:-nova-android-clean}"
STRIP_DIRS="dist build-output dist-app release-build release"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "error: working tree has staged/unstaged changes; refusing to run" >&2
  exit 1
fi

INDEX_FILE="$(git rev-parse --git-dir)/clean-replay.index"
rm -f "$INDEX_FILE"
export GIT_INDEX_FILE="$INDEX_FILE"

new_parent=""
count=0
for commit in $(git rev-list --reverse "$SRC_BRANCH"); do
  git read-tree "$commit^{tree}"
  for d in $STRIP_DIRS; do
    git rm -r --cached -q -f --ignore-unmatch "$d"
  done
  tree=$(git write-tree)

  GIT_AUTHOR_NAME=$(git log -1 --format='%an' "$commit")
  GIT_AUTHOR_EMAIL=$(git log -1 --format='%ae' "$commit")
  GIT_AUTHOR_DATE=$(git log -1 --format='%aI' "$commit")
  GIT_COMMITTER_NAME=$(git log -1 --format='%cn' "$commit")
  GIT_COMMITTER_EMAIL=$(git log -1 --format='%ce' "$commit")
  GIT_COMMITTER_DATE=$(git log -1 --format='%cI' "$commit")
  export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_AUTHOR_DATE
  export GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_DATE

  msg_file=$(mktemp)
  git log -1 --format='%B' "$commit" > "$msg_file"
  if [ -z "$new_parent" ]; then
    new_commit=$(git commit-tree "$tree" -F "$msg_file")
  else
    new_commit=$(git commit-tree "$tree" -p "$new_parent" -F "$msg_file")
  fi
  rm -f "$msg_file"

  new_parent="$new_commit"
  count=$((count + 1))
  echo "replayed $count: ${commit:0:8} -> ${new_commit:0:8}"
done

unset GIT_INDEX_FILE
rm -f "$INDEX_FILE"
git update-ref "refs/heads/$OUT_BRANCH" "$new_parent"
echo "clean branch ready: $OUT_BRANCH ($count commits)"
