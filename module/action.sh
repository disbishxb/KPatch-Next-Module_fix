#!/bin/sh

if pm path io.github.a13e300.ksuwebui >/dev/null 2>&1; then
    echo "- Launching WebUI in KSUWebUIStandalone..."
    am start -n "io.github.a13e300.ksuwebui/.WebUIActivity" -e id "KPatch-Next"
    echo "- WebUI launched successfully."
else
    echo "! No WebUI app found"
    sleep 2
    am start -a android.intent.action.VIEW -d "https://github.com/KOWX712/KsuWebUIStandalone/releases"
fi
