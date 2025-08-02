#!/bin/bash

# List of branches with conflicts
conflict_branches=(
    "origin/cursor/assess-and-plan-for-frontend-and-backend-issues-2277"
    "origin/cursor/assess-csv-excel-file-queryability-and-connection-0efb"
    "origin/cursor/assess-database-connection-error-handling-3e52"
    "origin/cursor/check-electron-security-vulnerabilities-ed34"
    "origin/cursor/close-table-overview-when-query-is-submitted-96a0"
    "origin/cursor/code-review-for-bugs-and-vulnerabilities-22b5"
    "origin/cursor/codebase-security-and-robustness-audit-f896"
    "origin/cursor/debug-sql-query-generation-failure-aa20"
    "origin/cursor/fix-column-type-detection-and-improve-file-uploads-f6ed"
    "origin/cursor/fix-middle-panel-resizing-bug-960f"
    "origin/cursor/fix-prompt-injection-detection-for-insights-d919"
    "origin/cursor/investigate-aws-db-connection-failure-cf4f"
    "origin/cursor/investigate-database-connection-parameters-682b"
    "origin/cursor/investigate-failed-sql-generation-in-chat-50c0"
    "origin/cursor/investigate-sqlite-connection-spinning-issue-f13a"
    "origin/cursor/make-db-connection-modal-scrollable-c13c"
    "origin/cursor/provide-feedback-on-db-connection-status-edbf"
    "origin/cursor/rearrange-left-panel-elements-for-usability-bc8a"
    "origin/cursor/refactor-modals-and-clean-up-codebase-a110"
    "origin/cursor/replace-overview-with-analysis-section-528d"
    "origin/cursor/restore-database-connection-indicator-4a9d"
    "origin/cursor/restore-left-panel-expand-and-db-icons-b252"
    "origin/cursor/review-application-markdown-file-f238"
    "origin/cursor/review-codebase-documentation-for-understanding-ee28"
    "origin/cursor/review-markdown-files-for-context-c763"
    "origin/cursor/scan-markdown-and-codebase-5b32"
    "origin/cursor/secure-llm-prompts-against-injection-7c8e"
    "origin/cursor/test-csv-excel-import-performance-and-bugs-a5c5"
    "origin/cursor/update-text-and-scrollbar-styles-76e1"
    "origin/cursor/write-mysql-unit-tests-38ad"
)

echo "This will delete ${#conflict_branches[@]} branches with conflicts."
echo "Are you sure you want to proceed? (yes/no)"
read -r response

if [[ "$response" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Deleting branches with conflicts..."
echo "=================================="

for branch in "${conflict_branches[@]}"; do
    # Extract just the branch name without origin/
    branch_name=${branch#origin/}
    echo -n "Deleting $branch_name... "
    
    if git push origin --delete "$branch_name" 2>/dev/null; then
        echo "✓ Deleted"
    else
        echo "✗ Failed (may already be deleted)"
    fi
done

echo ""
echo "Done! Deleted conflict branches."
echo ""
echo "Remaining clean branches that can be merged:"
echo "==========================================="
echo "- cursor/check-csv-and-xlsx-file-upload-support-697a"
echo "- cursor/fix-electron-connection-refused-errors-d891"
echo "- cursor/fix-prompt-injection-detection-for-insights-a93c"
echo "- cursor/style-scrollbars-for-subtle-consistency-f811"
echo "- cursor/test-file-import-system-functionality-9e28"
echo "- cursor/test-sqlite-macos-path-compatibility-618b"
