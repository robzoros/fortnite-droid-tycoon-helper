# FORTNITE DROID TYCOON HELPER
## Instrucciones completas del proyecto para agente IA

---

## Contexto del proyecto

Aplicación para saber dónde se necesitará un droide a partir del renacer actual del jugador y, en su caso, cuánto costaría actualizarlo en chips. El juego consiste en una serie de renaceres y super renaceres. Tras los super renaceres se cambia de ciclo (1 → 2 → 3 → 4).

### Terminología del juego

Los droides se dividen por **Rareza** (nivel base y probabilidad de aparición), **Clase** (tipo de función) y **Calidad** (etapa de mejora de rendimiento). Denominaciones oficiales:

- **Rareza**: `Common`, `Rare`, `Epic`, `Legendary`, `Mythic`, `Iconic`.
- **Calidad**: `Default`, `Gold`, `Diamond`, `Rainbow`, `Beskar`, `Galactic`.
- **Clase**: `Worker` (Trabajadores), `Astromech` (Astromecánicos), `Battle` (Combate).

En la UI y en el código se usan los términos **Rareza**, **Clase** y **Calidad** de forma consistente. **No** mezclar ni usar "rareza" para designar lo que el juego llama "calidad", ni "tipo" para lo que el juego llama "clase".

## Stack tecnológico

- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks).
- **Servidor**: `server.py` (Python 3 `http.server`) en puerto 8000, escucha en `0.0.0.0` para servir la app en la red local.
- **Lanzador**: `start.bat` (Windows) auto-eleva como Administrador y ejecuta `server.py`.
- **Diagnóstico**: `diagnostico.bat` muestra IP, perfil de red, regla de firewall y estado del servidor.

## Datos de entrada

El sistema lee los siguientes CSVs:

- **droids.csv** — `Rarity,Nombre,Clase`. La rareza puede tener espacios al final (caso `ICONIC `); siempre hacer `trim()`.
  - Columna 1 = **Rareza** (Common, Rare, Epic, Legendary, Mythic, Iconic).
  - Columna 3 = **Clase** (Worker, Astromech, Battle).
- **upgrade_chips.csv** — Cabecera `Rarity,Gold,Diamond,Rainbow,Beskar,Galactic`. Cada columna es el coste en chips para pasar de la calidad anterior a la indicada.
  - Mapeo de **rareza** de droids.csv → clave de upgrade_chips.csv:
    - `COMMON` → `Common`
    - `RARE` → `Rare`
    - `EPIC` → `Epic`
    - `LEGENDARY` → `Legend` (ojo, no `Legendary`)
    - `MYTHIC` → `Mythic`
    - `ICONIC` → sin entrada (no hay tabla de mejoras, el coste se mostrará como "no disponible")
- **renaceres_ciclo_1.csv** … **renaceres_ciclo_4.csv** — Columnas: `ciclo,renacer,creditos,droide_1,droide_2,droide_3`. Cada `droide_X` tiene formato `CALIDAD NOMBRE` (p. ej. `GOLD PROTO-ROLLER`). Para comparar por nombre hay que partir por el primer espacio; nunca buscar subcadena (`MOUSE` no debe matchear `SNOW MOUSE`).

## Funcionamiento de la UI

El usuario selecciona seis campos y pulsa **Buscar**:

1. **Ciclo** (obligatorio, 1–4). No existe opción "Todos": la búsqueda debe hacerse **siempre dentro de un ciclo**.
2. **Renacer actual** (obligatorio, 1–30). Representa el renacer en el que está el jugador. **No existe opción "Todos"**: la búsqueda muestra los renaceres **a partir del seleccionado** (`renacer >= renacerActual`).
3. **Rareza** (opcional): desplegable `#rareza-select` con las rarezas únicas presentes en `droids.csv` columna 1 (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC`, `ICONIC`, etc.). La lista se deriva dinámicamente de `droids.csv` para que se actualice sola si en el futuro aparecen nuevas rarezas. Por defecto `-- Todas --` (sin filtro).
4. **Clase** (opcional): desplegable `#clase` con las clases únicas presentes en `droids.csv` columna 3 (`WORKER`, `ASTROMECH`, `BATTLE`, etc.). También derivado dinámicamente. Por defecto `-- Todas --` (sin filtro).
5. **Droide** (obligatorio): desplegable con los droides únicos de `droids.csv` ordenados alfabéticamente. **Se filtra en vivo** según los valores de Rareza y Clase: si ambos están en "Todas" muestra todos; si solo uno está fijado, lista solo los droides que coinciden con ese criterio; si ambos están fijados, lista los droides que cumplen ambos. Si no hay coincidencias, el desplegable muestra `-- Ningún droide coincide --` y el botón **Buscar** no permitirá avanzar sin selección.
6. **Calidad actual** (obligatorio): desplegable `#calidad` con `DEFAULT`, `GOLD`, `DIAMOND`, `RAINBOW`, `BESKAR`. **Se usa SOLO para calcular el coste de mejora; nunca filtra los resultados.**

Tras pulsar **Buscar** se muestran dos paneles, en este orden:

### Panel 1 — Renaceres donde se necesita el droide
Tabla con una fila por coincidencia: `Ciclo`, `Renacer`, `Créditos`, `Calidad necesaria` (con badge de color), `Slot` (1, 2 o 3).

- Se listan todos los renaceres del ciclo seleccionado con `renacer >= renacerActual` en los que el droide aparece en cualquiera de los tres slots.
- La **calidad máxima necesaria** se calcula como la calidad más alta entre todas las coincidencias.

### Panel 2 — Coste de mejora
- Suma los pasos necesarios para pasar de `calidadActual` a `calidadMaxima` consultando `upgrade_chips.csv`.
- Ejemplo (de las instrucciones originales): droide `EPIC` en `GOLD` con calidad máxima necesaria `BESKAR` → 180 + 240 + 3000 = **3420 chips**.
- Si `calidadActual >= calidadMaxima` → coste **0 chips**, mensaje informativo. **En este caso la tabla de desglose se oculta**, no se muestra la cabecera vacía.
- Si la rareza del droide es `ICONIC` (sin fila en `upgrade_chips.csv`) → mensaje "no hay tabla de mejoras disponible" y la tabla de desglose también permanece oculta.
- Tabla desglose con filas `De | A | Coste` por cada salto de calidad (solo si hay pasos que mostrar).

### Modal de costes de rareza
- Junto al botón **Buscar** aparece un segundo botón **Ver costes de rareza** (`#ver-costes`).
- Al pulsarlo se abre una modal (`#cost-modal`) con una tabla que muestra el contenido íntegro de `upgrade_chips.csv`: filas = cada rareza base (`Common`, `Rare`, `Epic`, `Legend`, `Mythic`); columnas = `Gold`, `Diamond`, `Rainbow`, `Beskar`, `Galactic` con los chips necesarios para subir de la rareza anterior a la indicada.
- La modal se cierra con la `×` (`#cost-modal-close`), haciendo clic fuera del cuadro o pulsando `Escape`.
- La modal vuelve a renderizarse cada vez que se abre, de modo que refleja siempre la última versión del CSV tras un F5.

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
- **Orden de calidad**: `DEFAULT < GOLD < DIAMOND < RAINBOW < BESKAR < GALACTIC` (vector `QUALITY_ORDER`, alias interno `RARITY_ORDER` para la lógica de cálculo).
- **Estructura de datos**: `rebirths = [{ciclo, renacer, creditos, droid1, droid2, droid3}]` para los 4 ciclos combinados; `upgradeCosts = {Common: {GOLD, DIAMOND, ...}, ...}`; `droidNameToMeta = {NOMBRE: {rarity, class}}` para el filtrado en vivo de Rareza/Clase.
- **Droids sin fila de upgrade**: ICONIC. El panel de coste lo indica pero el de renaceres funciona normal.

## Convenciones

- HTML en `index.html`, CSS en `style.css`, lógica en `script.js`. Sin TypeScript, sin bundlers, sin npm.
- Sin comentarios en el código salvo que se pidan explícitamente.
- Idioma de la UI: español. Badges de calidad con colores distintivos (DEFAULT gris, GOLD dorado, DIAMOND celeste, RAINBOW degradado, BESKAR gris oscuro, GALACTIC morado/rosa).