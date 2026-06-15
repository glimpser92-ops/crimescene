Original prompt: 이 ppt와 똑같이 게임을 진행할 거야. 방장인 내가 증거를 보여주면 참가자들의 화면이 같은 화면을 볼 수 있게 해줘. 그리고 화면을 확대, 축소가 가능하게 해줘. 모든 게임의 흐름, 내용, 룰 전부 다 ppt대로 진행하는 게임을 만들어 줘.

Status:
- Copied the provided PPTX into the workspace as source.pptx.
- Built a local web game that preserves the PPT flow as rendered slides and synchronizes the host's current slide, zoom, pan, and waiting screen to participants in real time.

Completed:
- Exported all 62 PPT slides and now store them in the non-public slides folder.
- Extracted slide metadata to public/manifest.json for navigation.
- Implemented host/player room sync with Socket.IO.
- Added host controls for slide navigation, zoom in/out, reset, drag pan, and participant waiting screen.
- Verified with npm run test:smoke and screenshot inspection.
- Moved slide images out of the public static folder and added token-gated slide serving.
- Moved full slide metadata out of the public static folder and added token-filtered manifest serving.
- Added per-room released hint tracking: slides become available to students only after the host shows them.
- Added a student "공개 힌트" review panel so released hints can be reopened independently.
- Extended smoke tests to verify unreleased hints return 403, raw slide paths return 404, released hints return 200, and review mode works.
