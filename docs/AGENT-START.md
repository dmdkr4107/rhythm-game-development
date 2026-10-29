# 리듬게임 개발·테스트 AI 실행 방법 (Windows)

이미 구성된 `game_developer` 및 `game_tester` 에이전트를 Codex에서 사용하기 위한 시작 안내입니다.

## 시작하기

1. GitHub에서 이 저장소를 **Code → Download ZIP**으로 내려받고 압축을 풉니다. 기존 로컬 작업 폴더가 있다면 그 폴더를 이용해도 됩니다.
2. 압축을 푼 **rhythm-game-development-main** 폴더에 있는 `start-agent.cmd`를 더블클릭합니다.
3. Codex가 열리면 원하는 리듬게임 작업을 요청합니다. 예: "개발 에이전트와 테스트 에이전트를 사용해서 리듬게임 판정 오류를 분석해 줘. 구현 후 독립 검증하고, 필요 시 최대 3회 검증해 줘."
4. 작업 결과와 실제 독립 테스트 실행 여부를 확인하고, GitHub에 반영할지는 별도로 결정합니다.

## 실행 조건 및 주의사항

- Windows 및 이미 설치된 **Codex CLI**가 필요합니다. 실행에 실패하면 Windows 터미널에서 `codex --version`으로 설치 상태를 확인합니다.
- 루트 `AGENTS.md`, `docs/HARNESS.md`, `.codex/agents/game_developer.toml`, `.codex/agents/game_tester.toml`의 역할과 규칙을 활용합니다.
- `start-agent.cmd`는 Codex를 **리듬게임 폴더에서 여는 실행기**이며, 자체적으로 두 AI를 생성하거나 독립 테스트를 수행하는 도구는 아닙니다. 실제 하위 에이전트 실행은 Codex 환경의 지원 여부를 확인해야 합니다.
- 테스트 에이전트는 개발 에이전트의 작업 인계 후 독립 검증을 합니다. 최초 검증을 포함해 최대 3회만 진행합니다.
- Codex 시작 시에는 게임 파일을 수정하지 말도록 요청합니다. 이후 개별 작업은 사용자의 별도 지시에 따릅니다.
- 기존 게임 코드를 변경하지 않으며, 요청 없이 커밋하거나 GitHub에 업로드하지 않습니다.
