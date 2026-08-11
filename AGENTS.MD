# FORTNITE DROID TYCOON HELPER
## Instrucciones completas del proyecto para agente IA

---

## Contexto del proyecto

Aplicación para saber dónde se necesitará un droide a partir del renacer actual del jugador y, en su caso, cuánto costaría actualizarlo en chips. El juego consiste en una serie de renaceres y super renaceres. Tras los super renaceres se cambia de ciclo (1 → 2 → 3 → 4).

## Stack tecnológico

- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks).
- **Servidor**: `server.py` (Python 3 `http.server`) en puerto 8000, escucha en `0.0.0.0` para servir la app en la red local.
- **Lanzador**: `start.bat` (Windows) auto-eleva como Administrador y ejecuta `server.py`.
- **Diagnóstico**: `diagnostico.bat` muestra IP, perfil de red, regla de firewall y estado del servidor.

## Datos de entrada

El sistema lee los siguientes CSVs:

- **droids.csv** — `Rarity,Nombre,Tipo`. La rareza puede tener espacios al final (caso `ICONIC `); siempre hacer `trim()`.
- **upgrade_chips.csv** — Cabecera `Rarity,Gold,Diamond,Rainbow,Beskar,Galactic`. Cada columna es el coste para pasar de la rareza anterior a la indicada.
  - Mapeo de rareza de droids.csv → clave de upgrade_chips.csv:
    - `COMMON` → `Common`
    - `RARE` → `Rare`
    - `EPIC` → `Epic`
    - `LEGENDARY` → `Legend` (ojo, no `Legendary`)
    - `MYTHIC` → `Mythic`
    - `ICONIC` → sin entrada (no hay tabla de mejoras, el coste se mostrará como "no disponible")
- **renaceres_ciclo_1.csv** … **renaceres_ciclo_4.csv** — Columnas: `ciclo,renacer,creditos,droide_1,droide_2,droide_3`. Cada `droide_X` tiene formato `RARIDAD NOMBRE` (p. ej. `GOLD PROTO-ROLLER`). Para comparar por nombre hay que partir por el primer espacio; nunca buscar subcadena (`MOUSE` no debe matchear `SNOW MOUSE`).

## Funcionamiento de la UI

El usuario selecciona cuatro campos y pulsa **Buscar**:

1. **Ciclo** (obligatorio, 1–4). No existe opción "Todos": la búsqueda debe hacerse **siempre dentro de un ciclo**.
2. **Renacer actual** (obligatorio, 1–30). Representa el renacer en el que está el jugador. **No existe opción "Todos"**: la búsqueda muestra los renaceres **a partir del seleccionado** (`renacer >= renacerActual`).
3. **Droide** (obligatorio): desplegable con todos los droides únicos de `droids.csv`, ordenados alfabéticamente.
4. **Rareza actual** (obligatorio): `DEFAULT`, `GOLD`, `DIAMOND`, `RAINBOW`, `BESKAR`. **Se usa SOLO para calcular el coste de mejora; nunca filtra los resultados.**

Tras pulsar **Buscar** se muestran dos paneles, en este orden:

### Panel 1 — Renaceres donde se necesita el droide
Tabla con una fila por coincidencia: `Ciclo`, `Renacer`, `Créditos`, `Rareza necesaria` (con badge de color), `Slot` (1, 2 o 3).

- Se listan todos los renaceres del ciclo seleccionado con `renacer >= renacerActual` en los que el droide aparece en cualquiera de los tres slots.
- La **rareza máxima necesaria** se calcula como la rareza más alta entre todas las coincidencias.

### Panel 2 — Coste de mejora
- Suma los pasos necesarios para pasar de `rarezaActual` a `rarezaMaxima` consultando `upgrade_chips.csv`.
- Ejemplo (de las instrucciones originales): droide `EPIC` en `GOLD` con máxima necesaria `BESKAR` → 180 + 240 + 3000 = **3420 chips**.
- Si `rarezaActual >= rarezaMaxima` → coste **0 chips**, mensaje informativo.
- Si el droide es `ICONIC` (sin fila en `upgrade_chips.csv`) → mensaje "no hay tabla de mejoras disponible".
- Tabla desglose con filas `De | A | Coste` por cada salto de rareza.

## Despliegue y acceso en red local

1. Doble clic en **`start.bat`** (pide UAC una vez). Añade la regla de firewall `FortniteDroidTycoonHelper` y arranca el servidor.
2. El servidor imprime algo como:
   ```
   En este equipo:   http://localhost:8000/
   En la red local:  http://192.168.x.y:8000/
   ```
3. Abrir la URL de red local desde cualquier dispositivo conectado a la misma WiFi.

### Requisitos de red en Windows

- El perfil de red del adaptador Wi-Fi debe ser **Privado**, no Público:
  ```powershell
  Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private
  ```
- El móvil/tablet debe estar en la **misma WiFi** que el PC (no en red de invitados ni con datos móviles).
- Si hay antivirus/firewall de terceros (Kaspersky, Norton, etc.) puede bloquear aunque Windows permita; añadir excepción para `python.exe` o el puerto 8000.
- Si algo falla, ejecutar **`diagnostico.bat`** y revisar su salida.

## Recarga de datos

- `server.py` envía `Cache-Control: no-store`, por lo que **F5 en el navegador recarga siempre los CSVs** sin usar caché.
- No hay recarga automática: si se modifica un CSV, el usuario debe pulsar F5.

## Detalles técnicos relevantes

- **Servidor silencioso**: `handle()` captura `OSError` (cubre `ConnectionResetError`, `ConnectionAbortedError`, `BrokenPipeError`) para no ensuciar la consola cuando un cliente cierra la conexión a mitad de petición.
- **Parser CSV propio**: maneja comillas dobles; las celdas se trimean al insertar.
- **Orden de rareza**: `DEFAULT < GOLD < DIAMOND < RAINBOW < BESKAR < GALACTIC` (vector `RARITY_ORDER`).
- **Estructura de datos**: `rebirths = [{ciclo, renacer, creditos, droid1, droid2, droid3}]` para los 4 ciclos combinados; `upgradeCosts = {Common: {GOLD, DIAMOND, ...}, ...}`.
- **Droids sin fila de upgrade**: ICONIC. El panel de coste lo indica pero el de renaceres funciona normal.

## Convenciones

- HTML en `index.html`, CSS en `style.css`, lógica en `script.js`. Sin TypeScript, sin bundlers, sin npm.
- Sin comentarios en el código salvo que se pidan explícitamente.
- Idioma de la UI: español. Badges de rareza con colores distintivos (DEFAULT gris, GOLD dorado, DIAMOND celeste, RAINBOW degradado, BESKAR gris oscuro, GALACTIC morado/rosa).