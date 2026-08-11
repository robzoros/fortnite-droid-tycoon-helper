@echo off
echo === IP y adaptador ===
ipconfig | findstr /i "adaptador IPv4 Puerta"

echo.
echo === Perfil de red (Public/Private bloquea el acceso) ===
powershell -NoProfile -Command "Get-NetConnectionProfile | Format-Table Name, NetworkCategory, InterfaceAlias -AutoSize"

echo.
echo === Regla de firewall DroidHelper ===
netsh advfirewall firewall show rule name="FortniteDroidTycoonHelper" | findstr /i "Rule Name Enabled Profile Local Port Action"

echo.
echo === Servidor escuchando en puerto 8000 ===
netstat -an | findstr ":8000.*LISTENING"

echo.
echo === Prueba local ===
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 5).StatusCode } catch { 'ERROR: ' + \$_.Exception.Message }"

pause