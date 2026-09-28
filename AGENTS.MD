# FORTNITE DROID TYCOON HELPER
## Instrucciones completas del proyecto para agente IA

---

## Contexto del proyecto

Aplicación para saber dónde se necesitará un droide a partir del renacer actual del jugador y, en su caso, cuánto costaría actualizarlo en chips. El juego consiste en una serie de renaceres y super renaceres. Tras los super renaceres se cambia de ciclo (1 → 2 → 3 → 4 → 5).

### Terminología del juego

Los droides se dividen por **Rareza** (nivel base y probabilidad de aparición), **Clase** (tipo de función) y **Calidad** (etapa de mejora de rendimiento). Denominaciones oficiales:

- **Rareza**: `Common`, `Rare`, `Epic`, `Legendary`, `Mythic`, `Iconic`.
- **Calidad**: `Default`, `Gold`, `Diamond`, `Rainbow`, `Beskar`, `Galactic`, `Stellar`, `Kyber`.
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
- **upgrade_chips.csv** — Cabecera `Rarity,Gold,Diamond,Rainbow,Beskar,Galactic,Stellar,Kyber`. Cada columna es el coste en chips para pasar de la calidad anterior a la indicada. Las columnas de calidad se parsean dinámicamente desde la cabecera (`upgradeQualityColumns`), por lo que una nueva columna del CSV se refleja sola en la app.
  - Mapeo de **rareza** de droids.csv → clave de upgrade_chips.csv:
    - `COMMON` → `Common`
    - `RARE` → `Rare`
    - `EPIC` → `Epic`
    - `LEGENDARY` → `Legend` (ojo, no `Legendary`)
    - `MYTHIC` → `Mythic`
    - `ICONIC` → sin entrada (no hay tabla de mejoras, el coste se mostrará como "no disponible")
- **renaceres_ciclo_1.csv** … **renaceres_ciclo_5.csv** — Columnas: `ciclo,renacer,creditos,droide_1,droide_2,droide_3`. Cada `droide_X` tiene formato `CALIDAD NOMBRE` (p. ej. `GOLD PROTO-ROLLER`). Para comparar por nombre hay que partir por el primer espacio; nunca buscar subcadena (`MOUSE` no debe matchear `SNOW MOUSE`). Los ficheros se descubren dinámicamente sondeando `renaceres_ciclo_N.csv` (N = 1, 2, 3…) hasta que uno no existe, así que un ciclo futuro solo requiere añadir su CSV.
- **super_rebirths.csv** — Cabecera `Nivel_Rebirth,Cristales_Nova,Multiplicador_Creditos,Multiplicador_XP`. Un dato por super renacer (`RB12`…`RB40`): cristales Nova otorgados y porcentajes de incremento de ingresos y XP. Se muestra en la modal **Super Renaceres** del menú superior. Los valores aún no revelados por el juego pueden venir como `?`; se renderizan tal cual, sin parseo numérico.
- **images_droids.csv** — Cabecera `nombre,calidad,fichero`. Relaciona cada `nombre`+`calidad` con su fichero de imagen en `resources/` (patrón original `NOMBRE_RAREZA.webp`, con `_` en lugar de espacios). Sirve para resolver la imagen y el color de calidad del droide en el panel Restantes. No confundir con rareza.
- **fusion_droids.csv** — Cabecera `droid_name,type,rarity,droid_1,droid_2,droid_3,default_income,gold_income,...` (las columnas de ingresos se ignoran por ahora). Una fila por droide fusionado: `droid_name` es el resultado, `type` su clase, `rarity` su rareza y `droid_1..3` los **nombres simples** (sin calidad) de los tres droides necesarios. Se muestra en la modal **Fusiones** del menú superior. Los droides fusionados no existen ni en `droids.csv` ni en `images_droids.csv`; sus ingredientes sí.

## Funcionamiento de la UI

### Menú superior
- Bajo la cabecera hay un menú (`nav.top-menu`) con tres botones: **Super Renaceres** (`#menu-super-rebirths`), **Costes Rareza** (`#menu-cost-rarity`) y **Fusiones** (`#menu-fusions`).
- **Costes Rareza** abre la modal de costes de rareza (sustituyó al antiguo botón "Ver costes de rareza", ya eliminado).
- **Super Renaceres** abre la modal `#super-rebirths-modal` con los datos de `super_rebirths.csv` en cuatro columnas:
  - `Renacer` (nivel, p. ej. `RB12`).
  - `Cristales Nova`: icono `resources/Crystal.png` y debajo el número de cristales.
  - `% Ingresos incrementados`: icono `resources/Credits.webp` y debajo el porcentaje.
  - `% XP incrementado`: icono `resources/XP.png` y debajo su valor.
- Ambas modales se cierran con la `×`, clic fuera del cuadro o `Escape`, y se re-renderizan cada vez que se abren.
- **Fusiones** abre la modal `#fusion-modal` con el contenido de `fusion_droids.csv` en cinco columnas:
  - `Droide fusionado`: nombre (`droid_name`) coloreado con el color de su rareza.
  - `Rareza`: badge de color (`rarityBadge`) según `rarity`.
  - `Droide 1`, `Droide 2`, `Droide 3`: cada ingrediente renderizado con `renderNamedDroidCell(nombre)` (imagen desde `images_droids.csv` con calidad `DEFAULT`, fallback a `GOLD` y luego a `resources/Droidex-logo.PNG`; nombre coloreado por su rareza base en `droids.csv`).

El usuario selecciona seis campos y pulsa **Buscar**:

1. **Ciclo** (obligatorio, 1–5). El desplegable se genera dinámicamente según los ficheros `renaceres_ciclo_N.csv` encontrados. No existe opción "Todos": la búsqueda debe hacerse **siempre dentro de un ciclo**.
2. **Renacer actual** (obligatorio, 1–40). El máximo del desplegable se deriva del mayor `renacer` presente en los CSVs. Representa el renacer en el que está el jugador. **No existe opción "Todos"**: la búsqueda muestra los renaceres **a partir del seleccionado** (`renacer >= renacerActual`).
3. **Rareza** (opcional): desplegable `#rareza-select` con las rarezas únicas presentes en `droids.csv` columna 1 (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC`, `ICONIC`, etc.). La lista se deriva dinámicamente de `droids.csv` para que se actualice sola si en el futuro aparecen nuevas rarezas. Por defecto `-- Todas --` (sin filtro).
4. **Clase** (opcional): desplegable `#clase` con las clases únicas presentes en `droids.csv` columna 3 (`WORKER`, `ASTROMECH`, `BATTLE`, etc.). También derivado dinámicamente. Por defecto `-- Todas --` (sin filtro).
5. **Droide** (obligatorio): desplegable con los droides únicos de `droids.csv` ordenados alfabéticamente. **Se filtra en vivo** según los valores de Rareza y Clase: si ambos están en "Todas" muestra todos; si solo uno está fijado, lista solo los droides que coinciden con ese criterio; si ambos están fijados, lista los droides que cumplen ambos. Si no hay coincidencias, el desplegable muestra `-- Ningún droide coincide --` y el botón **Buscar** no permitirá avanzar sin selección.
6. **Calidad actual** (obligatorio): desplegable `#calidad` con `DEFAULT`, `GOLD`, `DIAMOND`, `RAINBOW`, `BESKAR`, `GALACTIC`, `STELLAR`, `KYBER`. **Se usa SOLO para calcular el coste de mejora; nunca filtra los resultados.**

Tras pulsar **Buscar** se muestran tres pestañas debajo, en este orden:

- **Necesario** — renaceres donde aparece el droide buscado.
- **Coste** — coste de mejora y desglose.
- **Restantes** — renaceres superiores al actual.

### Pestaña Necesario
Tabla con una fila por coincidencia: `Ciclo`, `Renacer`, `Créditos`, `Calidad necesaria` (con badge de color), `Slot` (1, 2 o 3).

- Se listan todos los renaceres del ciclo seleccionado con `renacer > renacerActual` en los que el droide aparece en cualquiera de los tres slots.
- La **calidad máxima necesaria** se calcula como la calidad más alta entre todas las coincidencias.

### Pestaña Coste
- Suma los pasos necesarios para pasar de `calidadActual` a `calidadMaxima` consultando `upgrade_chips.csv`.
- Ejemplo (de las instrucciones originales): droide `EPIC` en `GOLD` con calidad máxima necesaria `BESKAR` → 180 + 240 + 3000 = **3420 chips**.
- Si `calidadActual >= calidadMaxima` → coste **0 chips**, mensaje informativo. **En este caso la tabla de desglose se oculta**, no se muestra la cabecera vacía.
- Si la rareza del droide es `ICONIC` (sin fila en `upgrade_chips.csv`) → mensaje "no hay tabla de mejoras disponible" y la tabla de desglose también permanece oculta.
- Tabla desglose con filas `De | A | Coste` por cada salto de calidad (solo si hay pasos que mostrar).

### Pestaña Restantes
- Lista los renaceres del **mismo ciclo** con `renacer > renacerActual` (uno por fila).
- Columnas: `Renacer | Droide 1 | Droide 2 | Droide 3`.
- Cada celda de droide muestra la imagen desde `resources/<fichero>` (resuelta vía `images_droids.csv`), debajo el **nombre del droide** coloreado con el color de su **rareza** y, bajo el nombre, el badge de **calidad** necesaria.
- Colores por rareza (RGB) del nombre:
  - `COMMON` → verde `(0, 192, 73)`
  - `RARE` → azul `(0, 115, 230)`
  - `EPIC` → morado/púrpura `(163, 53, 238)`
  - `LEGENDARY` → naranja `(235, 117, 10)`
  - `MYTHIC` → rojo `(226, 45, 45)`
  - `ICONIC` → rosa `(211, 46, 172)`
- Si no existe imagen para esa combinación nombre+calidad se aplica una cadena de *fallback* para el `src` del `<img>` (la imagen ya nunca se oculta):
  1. Se prueba `imageLookup[nombre][calidad]`.
  2. Si la **calidad es `STELLAR`** y no hay fichero, se usa `imageLookup[nombre]['GOLD']`.
  3. En cualquier otro caso (incluido si `GOLD` tampoco existía en el paso anterior) se usa `imageLookup[nombre]['DEFAULT']`.
  4. Si tampoco existe `DEFAULT`, se usa `resources/Droidex-logo.PNG`.
- La calidad `KYBER` todavía no tiene imágenes propias en `images_droids.csv` ni en `resources/`, así que todos los droides KYBER caen al paso 3 y muestran su imagen `DEFAULT`. Cuando se añadan los ficheros `NOMBRE_KYBER.webp` basta con una fila más en `images_droids.csv`: el paso 1 los empezará a usar automáticamente.
- **Badge ÚLTIMO**: debajo del badge de calidad aparece la etiqueta `ÚLTIMO` (badge rojo/naranja destacado, `.droid-last`) cuando ese droide no vuelve a aparecer en ningún renacer posterior **del mismo ciclo**. Se calcula con `buildLastAppearance(ciclo)`, que precalcula el renacer máximo en que aparece cada droide dentro del ciclo; si el renacer de la fila coincide con ese máximo, se muestra la etiqueta.
- Si no quedan renaceres en el ciclo, se muestra el mensaje "No quedan renaceres superiores en este ciclo.".

### Modal de costes de rareza
- Se abre desde la opción **Costes Rareza** del menú superior (`#menu-cost-rarity`).
- Muestra una tabla con el contenido íntegro de `upgrade_chips.csv`: filas = cada rareza base (`Common`, `Rare`, `Epic`, `Legend`, `Mythic`); columnas = `Gold`, `Diamond`, `Rainbow`, `Beskar`, `Galactic`, `Stellar`, `Kyber` con los chips necesarios para subir de la rareza anterior a la indicada. Cabecera y filas se generan dinámicamente desde el CSV (`upgradeQualityColumns` / `upgradeRarityOrder`).
- La modal se cierra con la `×` (`#cost-modal-close`), haciendo clic fuera del cuadro o pulsando `Escape`.
- La modal vuelve a renderizarse cada vez que se abre, de modo que refleja siempre la última versión del CSV tras un F5.

### Modal de fusiones
- Se abre desde la opción **Fusiones** del menú superior (`#menu-fusions`).
- Muestra una fila por droide fusionado de `fusion_droids.csv` con columnas `Droide fusionado | Rareza | Droide 1 | Droide 2 | Droide 3` (estilo similar a la pestaña Restantes: celdas de droide con imagen y nombre coloreado, `.droid-cell`).
- Los droides fusionados no tienen imagen (no están en `images_droids.csv`), por lo que solo muestran nombre coloreado y badge de rareza.
- La modal (`#fusion-modal`) se cierra con la `×` (`#fusion-modal-close`), haciendo clic fuera del cuadro o pulsando `Escape`, y se re-renderiza cada vez que se abre.

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
- **Orden de calidad**: `DEFAULT < GOLD < DIAMOND < RAINBOW < BESKAR < GALACTIC < STELLAR < KYBER` (vector `QUALITY_ORDER`, alias interno `RARITY_ORDER` para la lógica de cálculo).
- **Estructura de datos**: `rebirths = [{ciclo, renacer, creditos, droid1, droid2, droid3}]` para todos los ciclos combinados; `upgradeCosts = {Common: {GOLD, DIAMOND, ...}, ...}`; `droidNameToMeta = {NOMBRE: {rarity, class}}` para el filtrado en vivo de Rareza/Clase; `imageLookup = {NOMBRE: {CALIDAD: fichero}}` para resolver imágenes del panel Restantes; `superRebirths = [{nivel, cristales, ingresos, xp}]` para la modal de Super Renaceres; `fusions = [{name, type, rarity, droid1, droid2, droid3}]` para la modal de Fusiones.
- **Droids sin fila de upgrade**: ICONIC. El panel de coste lo indica pero el de renaceres funciona normal.

## Convenciones

- HTML en `index.html`, CSS en `style.css`, lógica en `script.js`. Sin TypeScript, sin bundlers, sin npm.
- Sin comentarios en el código salvo que se pidan explícitamente.
- Idioma de la UI: español. Badges de calidad con colores distintivos (DEFAULT gris, GOLD dorado, DIAMOND celeste, RAINBOW degradado, BESKAR gris oscuro, GALACTIC morado/rosa, STELLAR blanco/cian degradado, KYBER verde chillón con resplandor neón).