#!/bin/bash

echo "Checking for branches with conflicts..."
echo "======================================="

# Get all remote cursor branches
branches=$(git branch -r --no-merged main | grep cursor | grep -v HEAD)

conflict_branches=()
clean_branches=()

for branch in $branches; do
    echo -n "Checking $branch... "
    
    # Try to merge with --no-commit to test for conflicts
    if git merge --no-commit --no-ff $branch >/dev/null 2>&1; then
        echo "✓ No conflicts"
        clean_branches+=("$branch")
        git merge --abort 2>/dev/null
    else
        echo "✗ Has conflicts"
        conflict_branches+=("$branch")
        git merge --abort 2>/dev/null
    fi
done

echo ""
echo "Branches with conflicts (${#conflict_branches[@]} total):"
echo "======================================="
for branch in "${conflict_branches[@]}"; do
    echo "$branch"
done

echo ""
echo "Clean branches (${#clean_branches[@]} total):"
echo "======================================="
for branch in "${clean_branches[@]}"; do
    echo "$branch"
done
