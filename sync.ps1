# Sync script — updates memory capsule timestamp, commits, and pushes
$projectDir = "C:\Users\Admin\Documents\OpenCode\Todo Meva"
Set-Location $projectDir

# Update timestamp in MEMORY_CAPSULE.md
$capsule = Get-Content "MEMORY_CAPSULE.md" -Raw
$today = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$capsule = $capsule -replace "(?<=\*Last Updated: ).*", "$today"
Set-Content "MEMORY_CAPSULE.md" $capsule

# Commit all changes
git add -A
$msg = if ($args[0]) { $args[0] } else { "Update: $((Get-Date).ToString('yyyy-MM-dd HH:mm'))" }
git commit -m "$msg"
git push

Write-Output "`n✓ Synced. Repo: https://github.com/kuldeep7ke/Todo-Meva"
