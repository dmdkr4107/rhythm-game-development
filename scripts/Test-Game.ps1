# 저장소 어디에서 실행해도 같은 검사를 수행하고, 첫 실패에서 종료합니다.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    $nodeCommand = Get-Command node -ErrorAction Stop
    $checks = @(
        @{ Name = '게임 스크립트 구문'; Arguments = @('--check', 'assets/js/game.js') },
        @{ Name = 'Firebase 스크립트 구문'; Arguments = @('--check', 'assets/js/firebase.js') },
        @{ Name = '필수 파일과 HTML 참조'; Arguments = @('tests/static-check.mjs') },
        @{ Name = '게임 회귀'; Arguments = @('tests/game-regression.mjs') }
    )
    foreach ($check in $checks) {
        Write-Host "검사: $($check.Name)"
        $nodeArguments = $check.Arguments
        & $nodeCommand.Source @nodeArguments
        if ($LASTEXITCODE -ne 0) {
            throw "$($check.Name) 실패 (종료 코드: $LASTEXITCODE)"
        }
    }
    Write-Host '자동 검사 통과. 실제 브라우저 플레이와 물리 입력 지연은 별도 확인이 필요합니다.'
}
finally {
    Pop-Location
}
